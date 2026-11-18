import { Injectable } from '@nestjs/common';
import {
  sql,
  type ExpressionBuilder,
  type Insertable,
  type Kysely,
  type OrderByDirection,
  type Updateable,
} from 'kysely';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import { DateTime } from 'luxon';
import { InjectKysely } from 'nestjs-kysely';
import { Chunked, ChunkedSet, DummyValue, GenerateSql } from 'src/decorators.js';
import { MemorySearchDto } from 'src/dtos/memory.dto.js';
import { AssetFileType, AssetOrderWithRandom, AssetVisibility, MemoryType } from 'src/enum.js';
import { type YearMonthDay } from 'src/repositories/asset.repository.js';
import { DB } from 'src/schema/index.js';
import { MemoryTable } from 'src/schema/tables/memory.table.js';
import type { IBulkAsset } from 'src/types.js';
import { asLocalTime } from 'src/utils/date.js';

const asMakeDate = (eb: ExpressionBuilder<DB, 'asset'>, { year, month, day }: YearMonthDay) =>
  eb.fn('make_date', [sql`${year}::int`, sql`${month}::int`, sql`${day}::int`]);

@Injectable()
export class MemoryRepository implements IBulkAsset {
  constructor(@InjectKysely() private db: Kysely<DB>) {}

  async cleanup() {
    await this.db
      .deleteFrom('memory_asset')
      .using('asset')
      .whereRef('memory_asset.assetId', '=', 'asset.id')
      .where('asset.visibility', '!=', AssetVisibility.Timeline)
      .execute();

    return this.db
      .deleteFrom('memory')
      .where('createdAt', '<', DateTime.now().minus({ days: 30 }).toJSDate())
      .where('isSaved', '=', false)
      .execute();
  }

  searchBuilder(ownerId: string, dto: MemorySearchDto) {
    return this.db
      .selectFrom('memory')
      .$if(dto.isSaved !== undefined, (qb) => qb.where('isSaved', '=', dto.isSaved!))
      .$if(dto.type !== undefined, (qb) => qb.where('type', '=', dto.type!))
      .$if(dto.for !== undefined, (qb) =>
        qb
          .where((where) => where.or([where('showAt', 'is', null), where('showAt', '<=', dto.for!)]))
          .where((where) => where.or([where('hideAt', 'is', null), where('hideAt', '>=', dto.for!)])),
      )
      .$if(dto.isUpcoming !== undefined, (qb) => {
        const now = asLocalTime(DateTime.now());
        return dto.isUpcoming
          ? qb.where('showAt', '>', now)
          : qb.where((where) => where.or([where('showAt', 'is', null), where('showAt', '<=', now)]));
      })
      .where('deletedAt', dto.isTrashed ? 'is not' : 'is', null)
      .where('ownerId', '=', ownerId);
  }

  @GenerateSql(
    { params: [DummyValue.UUID, {}] },
    { name: 'date filter', params: [DummyValue.UUID, { for: DummyValue.DATE }] },
  )
  statistics(ownerId: string, dto: MemorySearchDto) {
    return this.searchBuilder(ownerId, dto)
      .select((qb) => qb.fn.countAll<number>().as('total'))
      .executeTakeFirstOrThrow();
  }

  @GenerateSql(
    { params: [DummyValue.UUID, {}] },
    { name: 'date filter', params: [DummyValue.UUID, { for: DummyValue.DATE }] },
    { name: 'upcoming filter', params: [DummyValue.UUID, { isUpcoming: true }] },
    { name: 'not upcoming filter', params: [DummyValue.UUID, { isUpcoming: false }] },
  )
  search(ownerId: string, dto: MemorySearchDto) {
    return this.searchBuilder(ownerId, dto)
      .select((eb) =>
        jsonArrayFrom(
          eb
            .selectFrom('asset')
            .selectAll('asset')
            .innerJoin('memory_asset', 'asset.id', 'memory_asset.assetId')
            .whereRef('memory_asset.memoriesId', '=', 'memory.id')
            .where('asset.visibility', '=', sql.lit(AssetVisibility.Timeline))
            .where('asset.deletedAt', 'is', null)
            .where((eb) =>
              eb.not(
                eb.exists(
                  eb
                    .selectFrom('asset_face')
                    .innerJoin('person', (join) =>
                      join
                        .onRef('person.personGroupId', '=', 'asset_face.personGroupId')
                        .onRef('person.ownerId', '=', 'asset.ownerId'),
                    )
                    .select((eb) => eb.val(1).as('one'))
                    .whereRef('asset_face.assetId', '=', 'asset.id')
                    .where('person.isHidden', '=', true),
                ),
              ),
            )
            .orderBy('asset.fileCreatedAt', 'asc'),
        ).as('assets'),
      )
      .selectAll('memory')
      .$call((qb) => {
        if (dto.order === AssetOrderWithRandom.Random) {
          return qb.orderBy(sql`RANDOM()`);
        }

        const direction = (dto.order?.toLowerCase() || 'desc') as OrderByDirection;
        return qb
          .orderBy('showAt', (ob) => (direction === 'asc' ? ob.asc() : ob.desc()).nullsLast())
          .orderBy('memoryAt', direction);
      })
      .$if(dto.id !== undefined, (qb) => qb.where('id', '=', dto.id!))
      .$if(dto.size !== undefined, (qb) => qb.limit(dto.size!))
      .$if(dto.page !== undefined && dto.size !== undefined, (qb) => qb.offset((dto.page! - 1) * dto.size!))
      .execute();
  }

  private personAssets(ownerId: string, personGroupId: string) {
    return this.db
      .selectFrom('asset')
      .where('asset.ownerId', '=', ownerId)
      .where('asset.visibility', '=', AssetVisibility.Timeline)
      .where('asset.deletedAt', 'is', null)
      .where((eb) =>
        eb.exists((qb) =>
          qb
            .selectFrom('asset_face')
            .whereRef('asset_face.assetId', '=', 'asset.id')
            .where('asset_face.personGroupId', '=', personGroupId)
            .where('asset_face.deletedAt', 'is', null)
            .where('asset_face.isVisible', 'is', true),
        ),
      )
      .where((eb) =>
        eb.exists((qb) =>
          qb
            .selectFrom('asset_file')
            .whereRef('asset_file.assetId', '=', 'asset.id')
            .where('asset_file.type', '=', AssetFileType.Preview),
        ),
      );
  }

  @GenerateSql({
    params: [DummyValue.UUID, DummyValue.UUID, { year: 2000, month: 1, day: 1 }, { year: 2025, month: 1, day: 1 }],
  })
  async getPersonBirthdayYears(
    ownerId: string,
    personGroupId: string,
    birthDate: YearMonthDay,
    until: YearMonthDay,
  ): Promise<number[]> {
    const rows = await this.personAssets(ownerId, personGroupId)
      .where(sql`date_part('month', (asset."localDateTime" at time zone 'UTC')::date)::int`, '=', birthDate.month)
      .where(sql`date_part('day', (asset."localDateTime" at time zone 'UTC')::date)::int`, '=', birthDate.day)
      .where((eb) => eb(sql`(asset."localDateTime" at time zone 'UTC')::date`, '>=', asMakeDate(eb, birthDate)))
      .where((eb) => eb(sql`(asset."localDateTime" at time zone 'UTC')::date`, '<', asMakeDate(eb, until)))
      .select(sql<number>`date_part('year', (asset."localDateTime" at time zone 'UTC')::date)::int`.as('year'))
      .distinct()
      .orderBy(sql`year`, 'desc')
      .execute();

    return rows.map(({ year }) => year);
  }

  @GenerateSql({ params: [DummyValue.UUID, DummyValue.UUID, { year: 2000, month: 1, day: 1 }, 5] })
  getPersonAssetsByDate(ownerId: string, personGroupId: string, date: YearMonthDay, limit: number) {
    return this.personAssets(ownerId, personGroupId)
      .select(['asset.id'])
      .where((eb) => eb(sql`(asset."localDateTime" at time zone 'UTC')::date`, '=', asMakeDate(eb, date)))
      .orderBy('asset.localDateTime', 'desc')
      .limit(limit)
      .execute();
  }

  @GenerateSql({ params: [DummyValue.UUID] })
  get(id: string) {
    return this.getByIdBuilder(id).executeTakeFirst();
  }

  async create(memory: Insertable<MemoryTable>, assetIds: Set<string>) {
    const id = await this.db.transaction().execute(async (tx) => {
      const { id } = await tx.insertInto('memory').values(memory).returning('id').executeTakeFirstOrThrow();

      if (assetIds.size > 0) {
        const values = [...assetIds].map((assetId) => ({ memoriesId: id, assetId }));
        await tx.insertInto('memory_asset').values(values).execute();
      }

      return id;
    });

    return this.getByIdBuilder(id).executeTakeFirstOrThrow();
  }

  @GenerateSql({ params: [DummyValue.UUID, { ownerId: DummyValue.UUID, isSaved: true }] })
  async update(id: string, memory: Updateable<MemoryTable>) {
    await this.db.updateTable('memory').set(memory).where('id', '=', id).execute();
    return this.getByIdBuilder(id).executeTakeFirstOrThrow();
  }

  @GenerateSql({ params: [DummyValue.UUID] })
  async delete(id: string) {
    await this.db.deleteFrom('memory').where('id', '=', id).execute();
  }

  @GenerateSql({ params: [DummyValue.UUID, [DummyValue.UUID]] })
  @ChunkedSet({ paramIndex: 1 })
  async getAssetIds(id: string, assetIds: string[]) {
    if (assetIds.length === 0) {
      return new Set<string>();
    }

    const results = await this.db
      .selectFrom('memory_asset')
      .select(['assetId'])
      .where('memoriesId', '=', id)
      .where('assetId', 'in', assetIds)
      .execute();

    return new Set(results.map(({ assetId }) => assetId));
  }

  @GenerateSql({ params: [DummyValue.UUID, [DummyValue.UUID]] })
  async addAssetIds(id: string, assetIds: string[]) {
    if (assetIds.length === 0) {
      return;
    }

    await this.db
      .insertInto('memory_asset')
      .values(assetIds.map((assetId) => ({ memoriesId: id, assetId })))
      .execute();
  }

  @Chunked({ paramIndex: 1 })
  @GenerateSql({ params: [DummyValue.UUID, [DummyValue.UUID]] })
  async removeAssetIds(id: string, assetIds: string[]) {
    if (assetIds.length === 0) {
      return;
    }

    await this.db.deleteFrom('memory_asset').where('memoriesId', '=', id).where('assetId', 'in', assetIds).execute();
  }

  visibleTimelineAssets(ownerId: string) {
    return this.db
      .selectFrom('asset')
      .where('asset.ownerId', '=', ownerId)
      .where('asset.visibility', '=', AssetVisibility.Timeline)
      .where('asset.deletedAt', 'is', null)
      .where((eb) =>
        eb.exists((qb) =>
          qb
            .selectFrom('asset_file')
            .whereRef('asset_file.assetId', '=', 'asset.id')
            .where('asset_file.type', '=', AssetFileType.Preview),
        ),
      );
  }

  async hasRecentMemory(ownerId: string, type: MemoryType, memoryAtThreshold: string): Promise<boolean> {
    const existing = await this.db
      .selectFrom('memory')
      .select('id')
      .where('ownerId', '=', ownerId)
      .where('type', '=', type)
      .where('deletedAt', 'is', null)
      .where(sql<boolean>`"memoryAt" >= ${memoryAtThreshold}::timestamptz`)
      .limit(1)
      .executeTakeFirst();

    return !!existing;
  }

  async getThisWeekLookbackAssets(ownerId: string, targetMonth: number, targetDay: number, currentYear: number) {
    return this.visibleTimelineAssets(ownerId)
      .select([
        'asset.id',
        'asset.localDateTime',
        sql<number>`date_part('year', (asset."localDateTime" at time zone 'UTC')::date)::int`.as('year'),
      ])
      .where(sql`date_part('year', (asset."localDateTime" at time zone 'UTC')::date)::int`, '<', currentYear)
      .where(
        sql<boolean>`abs(date_part('doy', (asset."localDateTime" at time zone 'UTC')::date)::int - date_part('doy', make_date(${currentYear}::int, ${targetMonth}::int, ${targetDay}::int))::int) <= 3`,
      )
      .orderBy('asset.localDateTime', 'desc')
      .execute();
  }

  async getRecentHighlightAssets(ownerId: string, sinceDate: string, untilDate: string) {
    return this.visibleTimelineAssets(ownerId)
      .select(['asset.id', 'asset.isFavorite', 'asset.localDateTime'])
      .where(sql<boolean>`(asset."localDateTime" at time zone 'UTC') >= ${sinceDate}::timestamptz`)
      .where(sql<boolean>`(asset."localDateTime" at time zone 'UTC') <= ${untilDate}::timestamptz`)
      .orderBy('asset.isFavorite', 'desc')
      .orderBy('asset.localDateTime', 'desc')
      .limit(30)
      .execute();
  }

  async getSeasonAssets(ownerId: string, startDate: string, endDate: string) {
    return this.visibleTimelineAssets(ownerId)
      .select(['asset.id', 'asset.isFavorite', 'asset.localDateTime'])
      .where(sql<boolean>`(asset."localDateTime" at time zone 'UTC') >= ${startDate}::timestamptz`)
      .where(sql<boolean>`(asset."localDateTime" at time zone 'UTC') <= ${endDate}::timestamptz`)
      .orderBy('asset.isFavorite', 'desc')
      .orderBy('asset.localDateTime', 'desc')
      .limit(35)
      .execute();
  }

  async getMilestoneAssets(ownerId: string, targetYear: number, targetMonth: number, targetDay: number) {
    return this.visibleTimelineAssets(ownerId)
      .select(['asset.id', 'asset.localDateTime'])
      .where(
        (eb) =>
          eb(
            sql`(asset."localDateTime" at time zone 'UTC')::date`,
            '=',
            asMakeDate(eb, { year: targetYear, month: targetMonth, day: targetDay }),
          ),
      )
      .orderBy('asset.localDateTime', 'desc')
      .limit(25)
      .execute();
  }

  async getPeopleForGrowthMemories(ownerId: string) {
    return this.db
      .selectFrom('person')
      .innerJoin('asset_face', (join) =>
        join
          .onRef('asset_face.personGroupId', '=', 'person.personGroupId')
          .on('asset_face.deletedAt', 'is', null)
          .on('asset_face.isVisible', 'is', true),
      )
      .innerJoin('asset', (join) =>
        join
          .onRef('asset.id', '=', 'asset_face.assetId')
          .on('asset.ownerId', '=', ownerId)
          .on('asset.visibility', '=', sql.lit(AssetVisibility.Timeline))
          .on('asset.deletedAt', 'is', null),
      )
      .where('person.ownerId', '=', ownerId)
      .where('person.isHidden', '=', false)
      .select([
        'person.personGroupId',
        'person.name',
        sql<number>`count(distinct date_part('year', (asset."localDateTime" at time zone 'UTC')::date)::int)`.as('yearsCount'),
        sql<number>`min(date_part('year', (asset."localDateTime" at time zone 'UTC')::date)::int)`.as('minYear'),
        sql<number>`max(date_part('year', (asset."localDateTime" at time zone 'UTC')::date)::int)`.as('maxYear'),
      ])
      .groupBy(['person.personGroupId', 'person.name'])
      .having(sql`count(distinct date_part('year', (asset."localDateTime" at time zone 'UTC')::date)::int)`, '>=', 2)
      .orderBy('yearsCount', 'desc')
      .limit(5)
      .execute();
  }

  async getPersonGrowthAssets(ownerId: string, personGroupId: string) {
    return this.personAssets(ownerId, personGroupId)
      .select([
        'asset.id',
        'asset.localDateTime',
        sql<number>`date_part('year', (asset."localDateTime" at time zone 'UTC')::date)::int`.as('year'),
      ])
      .orderBy('asset.localDateTime', 'asc')
      .limit(30)
      .execute();
  }

  async getTripEventClusters(ownerId: string) {
    return this.db
      .selectFrom('asset')
      .innerJoin('asset_exif', 'asset_exif.assetId', 'asset.id')
      .where('asset.ownerId', '=', ownerId)
      .where('asset.visibility', '=', sql.lit(AssetVisibility.Timeline))
      .where('asset.deletedAt', 'is', null)
      .where((eb) =>
        eb.or([
          eb('asset_exif.city', 'is not', null),
          eb('asset_exif.country', 'is not', null),
        ]),
      )
      .select([
        sql<string>`coalesce(asset_exif.city, asset_exif.country)`.as('place'),
        sql<number>`date_part('year', (asset."localDateTime" at time zone 'UTC')::date)::int`.as('year'),
        sql<number>`date_part('month', (asset."localDateTime" at time zone 'UTC')::date)::int`.as('month'),
        sql<number>`count(asset.id)`.as('assetCount'),
      ])
      .groupBy([
        sql`coalesce(asset_exif.city, asset_exif.country)`,
        sql`date_part('year', (asset."localDateTime" at time zone 'UTC')::date)::int`,
        sql`date_part('month', (asset."localDateTime" at time zone 'UTC')::date)::int`,
      ])
      .having(sql`count(asset.id)`, '>=', 4)
      .orderBy(sql`count(asset.id)`, 'desc')
      .limit(5)
      .execute();
  }

  async getAssetsByPlaceAndMonth(ownerId: string, place: string, year: number, month: number, limit = 25) {
    return this.visibleTimelineAssets(ownerId)
      .innerJoin('asset_exif', 'asset_exif.assetId', 'asset.id')
      .where(sql`coalesce(asset_exif.city, asset_exif.country)`, '=', place)
      .where(sql`date_part('year', (asset."localDateTime" at time zone 'UTC')::date)::int`, '=', year)
      .where(sql`date_part('month', (asset."localDateTime" at time zone 'UTC')::date)::int`, '=', month)
      .select(['asset.id'])
      .orderBy('asset.localDateTime', 'asc')
      .limit(limit)
      .execute();
  }

  async getVisualPatternSimilarAssets(ownerId: string, limit = 20) {
    return this.db
      .selectFrom('smart_search as s1')
      .innerJoin('smart_search as s2', (join) =>
        join
          .on(sql<boolean>`s1."assetId" != s2."assetId"`)
          .on(sql<boolean>`s1.embedding <=> s2.embedding < 0.25`),
      )
      .innerJoin('asset as a1', (join) =>
        join
          .onRef('a1.id', '=', 's1.assetId')
          .on('a1.ownerId', '=', ownerId)
          .on('a1.visibility', '=', sql.lit(AssetVisibility.Timeline))
          .on('a1.deletedAt', 'is', null),
      )
      .innerJoin('asset as a2', (join) =>
        join
          .onRef('a2.id', '=', 's2.assetId')
          .on('a2.ownerId', '=', ownerId)
          .on('a2.visibility', '=', sql.lit(AssetVisibility.Timeline))
          .on('a2.deletedAt', 'is', null),
      )
      .select(['s1.assetId as id1', 's2.assetId as id2'])
      .limit(limit)
      .execute();
  }

  async getAestheticAssets(ownerId: string, limit = 25) {
    return this.visibleTimelineAssets(ownerId)
      .select(['asset.id', 'asset.isFavorite', 'asset.localDateTime'])
      .orderBy('asset.isFavorite', 'desc')
      .orderBy('asset.localDateTime', 'desc')
      .limit(limit)
      .execute();
  }

  async getHolidayAssets(ownerId: string, startMonth: number, startDay: number, endMonth: number, endDay: number) {
    return this.visibleTimelineAssets(ownerId)
      .select([
        'asset.id',
        'asset.localDateTime',
        sql<number>`date_part('year', (asset."localDateTime" at time zone 'UTC')::date)::int`.as('year'),
      ])
      .where((eb) => {
        if (startMonth === endMonth) {
          return eb.and([
            eb(sql`date_part('month', (asset."localDateTime" at time zone 'UTC')::date)::int`, '=', startMonth),
            eb(sql`date_part('day', (asset."localDateTime" at time zone 'UTC')::date)::int`, '>=', startDay),
            eb(sql`date_part('day', (asset."localDateTime" at time zone 'UTC')::date)::int`, '<=', endDay),
          ]);
        }
        return eb.or([
          eb.and([
            eb(sql`date_part('month', (asset."localDateTime" at time zone 'UTC')::date)::int`, '=', startMonth),
            eb(sql`date_part('day', (asset."localDateTime" at time zone 'UTC')::date)::int`, '>=', startDay),
          ]),
          eb.and([
            eb(sql`date_part('month', (asset."localDateTime" at time zone 'UTC')::date)::int`, '=', endMonth),
            eb(sql`date_part('day', (asset."localDateTime" at time zone 'UTC')::date)::int`, '<=', endDay),
          ]),
        ]);
      })
      .orderBy('asset.localDateTime', 'desc')
      .limit(25)
      .execute();
  }

  async getLivePhotoAssets(ownerId: string, limit = 25) {
    return this.visibleTimelineAssets(ownerId)
      .where((eb) =>
        eb.or([
          eb('asset.livePhotoVideoId', 'is not', null),
          eb.exists(
            eb
              .selectFrom('asset_exif')
              .whereRef('asset_exif.assetId', '=', 'asset.id')
              .where('asset_exif.livePhotoCID', 'is not', null),
          ),
        ]),
      )
      .select(['asset.id'])
      .orderBy('asset.localDateTime', 'desc')
      .limit(limit)
      .execute();
  }

  async getBurstAssets(ownerId: string, limit = 25) {
    return this.visibleTimelineAssets(ownerId)
      .innerJoin('asset_exif', 'asset_exif.assetId', 'asset.id')
      .where('asset_exif.autoStackId', 'is not', null)
      .select(['asset.id'])
      .orderBy('asset.localDateTime', 'desc')
      .limit(limit)
      .execute();
  }

  async getCollaborativeAlbumAssets(ownerId: string) {
    return this.db
      .selectFrom('album')
      .innerJoin('album_asset', 'album_asset.albumId', 'album.id')
      .innerJoin('asset', (join) =>
        join
          .onRef('asset.id', '=', 'album_asset.assetId')
          .on('asset.visibility', '=', sql.lit(AssetVisibility.Timeline))
          .on('asset.deletedAt', 'is', null),
      )
      .where((eb) =>
        eb.exists(
          eb
            .selectFrom('album_user')
            .whereRef('album_user.albumId', '=', 'album.id')
            .where('album_user.userId', '=', ownerId),
        ),
      )
      .select([
        'album.id as albumId',
        'album.albumName',
        sql<number>`count(distinct asset."ownerId")`.as('contributorCount'),
        sql<number>`count(asset.id)`.as('assetCount'),
      ])
      .groupBy(['album.id', 'album.albumName'])
      .having(sql`count(distinct asset."ownerId")`, '>=', 2)
      .having(sql`count(asset.id)`, '>=', 3)
      .limit(3)
      .execute();
  }

  async getAssetsForAlbum(albumId: string, limit = 25) {
    return this.db
      .selectFrom('album_asset')
      .innerJoin('asset', (join) =>
        join
          .onRef('asset.id', '=', 'album_asset.assetId')
          .on('asset.visibility', '=', sql.lit(AssetVisibility.Timeline))
          .on('asset.deletedAt', 'is', null),
      )
      .where('album_asset.albumId', '=', albumId)
      .select(['asset.id'])
      .orderBy('asset.localDateTime', 'asc')
      .limit(limit)
      .execute();
  }

  private getByIdBuilder(id: string) {
    return this.db
      .selectFrom('memory')
      .selectAll('memory')
      .select((eb) =>
        jsonArrayFrom(
          eb
            .selectFrom('asset')
            .selectAll('asset')
            .innerJoin('memory_asset', 'asset.id', 'memory_asset.assetId')
            .whereRef('memory_asset.memoriesId', '=', 'memory.id')
            .orderBy('asset.fileCreatedAt', 'asc')
            .where('asset.visibility', '=', sql.lit(AssetVisibility.Timeline))
            .where('asset.deletedAt', 'is', null),
        ).as('assets'),
      )
      .where('id', '=', id)
      .where('deletedAt', 'is', null);
  }
}
