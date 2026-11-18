import { Injectable } from '@nestjs/common';
import { shuffle } from 'lodash-es';
import { DateTime } from 'luxon';
import { Memory } from 'src/database.js';
import { OnJob } from 'src/decorators.js';
import { BulkIdResponseDto, BulkIdsDto } from 'src/dtos/asset-ids.response.dto.js';
import { AuthDto } from 'src/dtos/auth.dto.js';
import {
  MemoryCreateDto,
  MemoryResponseDto,
  MemorySearchDto,
  MemoryUpdateDto,
  mapMemory,
} from 'src/dtos/memory.dto.js';
import { DatabaseLock, JobName, MemoryType, Permission, QueueName, SystemMetadataKey } from 'src/enum.js';
import { type YearMonthDay } from 'src/repositories/asset.repository.js';
import { BaseService } from 'src/services/base.service.js';
import { addAssets, removeAssets } from 'src/utils/asset.util.js';
import { findOrFail } from 'src/utils/misc.js';

const DAYS = 3;
const DAYS_UNTIL_BIRTHDAY = 3;
const BIRTHDAY_MEMORY_ASSETS_PER_YEAR = 5;
const MEMORY_ASSET_LIMIT = 25;

@Injectable()
export class MemoryService extends BaseService {
  @OnJob({ name: JobName.MemoryGenerate, queue: QueueName.BackgroundTask })
  async onMemoriesCreate() {
    const users = await this.userRepository.getList({ withDeleted: false });

    await this.databaseRepository.withLock(DatabaseLock.MemoryCreation, async () => {
      const state = await this.systemMetadataRepository.get(SystemMetadataKey.MemoriesState);
      const start = DateTime.utc().startOf('day').minus({ days: DAYS });
      const lastOnThisDayDate = state?.lastOnThisDayDate ? DateTime.fromISO(state.lastOnThisDayDate) : start;

      // generate a memory +/- X days from today
      for (let i = 0; i <= DAYS * 2; i++) {
        const target = start.plus({ days: i });
        if (lastOnThisDayDate >= target) {
          continue;
        }

        this.logger.log(`Creating memories for ${target.toISO()}`);
        try {
          await Promise.all(
            users.map((owner) =>
              Promise.all([
                this.createOnThisDayMemories(owner.id, target),
                this.createBirthdayMemories(owner.id, target),
                this.createThisWeekMemories(owner.id, target),
                this.createRecentHighlightsMemories(owner.id, target),
                this.createSeasonSummaryMemories(owner.id, target),
                this.createMilestoneAnniversaryMemories(owner.id, target),
                this.createPeoplePetGrowthMemories(owner.id, target),
                this.createTripEventMemories(owner.id, target),
                this.createVisualPatternMemories(owner.id, target),
                this.createHolidayCelebrationMemories(owner.id, target),
                this.createAutomatedCreationMemories(owner.id, target),
                this.createCollaborativeMemories(owner.id, target),
              ]),
            ),
          );
        } catch (error) {
          this.logger.error(`Failed to create memories for ${target.toISO()}: ${error}`);
        }
        // update system metadata even when there is an error to minimize the chance of duplicates
        await this.systemMetadataRepository.set(SystemMetadataKey.MemoriesState, {
          ...state,
          lastOnThisDayDate: target.toISO(),
        });
      }
    });
  }

  private async createOnThisDayMemories(ownerId: string, target: DateTime) {
    const showAt = target.startOf('day').toISO();
    const hideAt = target.endOf('day').toISO();
    const memories = await this.assetRepository.getByDayOfYear([ownerId], target);
    await Promise.all(
      memories.map(({ year, assets }) =>
        this.memoryRepository.create(
          {
            ownerId,
            type: MemoryType.OnThisDay,
            data: { year },
            memoryAt: target.set({ year }).toISO()!,
            showAt,
            hideAt,
          },
          new Set(assets.map(({ id }) => id)),
        ),
      ),
    );
  }

  private async createBirthdayMemories(ownerId: string, target: DateTime) {
    const people = await this.personRepository.forBirthdayMemories(ownerId, target);
    if (people.length === 0) {
      return;
    }

    const showAt = target.minus({ days: DAYS_UNTIL_BIRTHDAY }).startOf('day').toISO();
    const hideAt = target.endOf('day').toISO();

    await Promise.all(
      people.map(async ({ personGroupId, name: personName, birthDate }) => {
        const assets = await this.getBirthdayAssets(ownerId, personGroupId, birthDate, target);
        if (assets.length === 0) {
          return;
        }

        await this.memoryRepository.create(
          {
            ownerId,
            type: MemoryType.Birthday,
            data: { personId: personGroupId, personName, year: birthDate.year },
            memoryAt: target.startOf('day').toISO()!,
            showAt,
            hideAt,
          },
          new Set(assets.map(({ id }) => id)),
        );
      }),
    );
  }

  private async getBirthdayAssets(
    ownerId: string,
    personGroupId: string,
    birthDate: YearMonthDay,
    until: YearMonthDay,
  ) {
    const years = await this.memoryRepository.getPersonBirthdayYears(ownerId, personGroupId, birthDate, until);
    if (years.length === 0) {
      return [];
    }

    let birthdayYears = years;
    let assetsPerYear = Math.min(BIRTHDAY_MEMORY_ASSETS_PER_YEAR, Math.floor(MEMORY_ASSET_LIMIT / years.length));

    // Select random birthdays if there are more than 25 birthdays with assets
    if (years.length > MEMORY_ASSET_LIMIT) {
      birthdayYears = shuffle(years)
        .slice(0, MEMORY_ASSET_LIMIT)
        .sort((a, b) => b - a);
      assetsPerYear = 1;
    }

    const assets = await Promise.all(
      birthdayYears.map((year) =>
        this.memoryRepository.getPersonAssetsByDate(ownerId, personGroupId, { ...birthDate, year }, assetsPerYear),
      ),
    );

    return assets.flat();
  }

  private async createThisWeekMemories(ownerId: string, target: DateTime) {
    const hasRecent = await this.memoryRepository.hasRecentMemory(
      ownerId,
      MemoryType.ThisWeekLastYear,
      target.minus({ days: 4 }).toISO()!,
    );
    if (hasRecent) {
      return;
    }

    const lookbackAssets = await this.memoryRepository.getThisWeekLookbackAssets(
      ownerId,
      target.month,
      target.day,
      target.year,
    );
    if (lookbackAssets.length < 3) {
      return;
    }

    const groupedByYear = new Map<number, typeof lookbackAssets>();
    for (const asset of lookbackAssets) {
      const year = asset.year;
      if (!groupedByYear.has(year)) {
        groupedByYear.set(year, []);
      }
      groupedByYear.get(year)!.push(asset);
    }

    const showAt = target.startOf('day').toISO();
    const hideAt = target.plus({ days: 2 }).endOf('day').toISO();

    for (const [year, assets] of groupedByYear.entries()) {
      if (assets.length >= 3) {
        const yearsAgo = target.year - year;
        await this.memoryRepository.create(
          {
            ownerId,
            type: MemoryType.ThisWeekLastYear,
            data: {
              year,
              title: `This Week ${yearsAgo === 1 ? '1 Year' : `${yearsAgo} Years`} Ago`,
              subtitle: `Moments from this week in ${year}`,
            },
            memoryAt: target.set({ year }).toISO()!,
            showAt,
            hideAt,
          },
          new Set(assets.map(({ id }) => id)),
        );
      }
    }
  }

  private async createRecentHighlightsMemories(ownerId: string, target: DateTime) {
    const hasRecent = await this.memoryRepository.hasRecentMemory(
      ownerId,
      MemoryType.RecentHighlights,
      target.minus({ days: 4 }).toISO()!,
    );
    if (hasRecent) {
      return;
    }

    const assets = await this.memoryRepository.getRecentHighlightAssets(
      ownerId,
      target.minus({ days: 14 }).toISO()!,
      target.toISO()!,
    );
    if (assets.length < 3) {
      return;
    }

    await this.memoryRepository.create(
      {
        ownerId,
        type: MemoryType.RecentHighlights,
        data: {
          period: 'Past 2 Weeks',
          year: target.year,
          title: 'Recent Highlights',
          subtitle: 'Best shots from the past few days',
        },
        memoryAt: target.toISO()!,
        showAt: target.startOf('day').toISO(),
        hideAt: target.plus({ days: 2 }).endOf('day').toISO(),
      },
      new Set(assets.map(({ id }) => id)),
    );
  }

  private async createSeasonSummaryMemories(ownerId: string, target: DateTime) {
    const hasRecent = await this.memoryRepository.hasRecentMemory(
      ownerId,
      MemoryType.SeasonSummary,
      target.minus({ days: 20 }).toISO()!,
    );
    if (hasRecent) {
      return;
    }

    const seasonNames: Record<number, string> = {
      12: 'Winter',
      1: 'Winter',
      2: 'Winter',
      3: 'Spring',
      4: 'Spring',
      5: 'Spring',
      6: 'Summer',
      7: 'Summer',
      8: 'Summer',
      9: 'Autumn',
      10: 'Autumn',
      11: 'Autumn',
    };
    const season = seasonNames[target.month] || 'Season';

    const assets = await this.memoryRepository.getSeasonAssets(
      ownerId,
      target.minus({ days: 90 }).toISO()!,
      target.toISO()!,
    );
    if (assets.length < 4) {
      return;
    }

    await this.memoryRepository.create(
      {
        ownerId,
        type: MemoryType.SeasonSummary,
        data: {
          season,
          year: target.year,
          title: `${season} Highlights ${target.year}`,
          subtitle: `A roundup of your favorite moments this ${season.toLowerCase()}`,
        },
        memoryAt: target.toISO()!,
        showAt: target.startOf('day').toISO(),
        hideAt: target.plus({ days: 3 }).endOf('day').toISO(),
      },
      new Set(assets.map(({ id }) => id)),
    );
  }

  private async createMilestoneAnniversaryMemories(ownerId: string, target: DateTime) {
    const milestones = [1, 2, 3, 5, 10];
    for (const yearsAgo of milestones) {
      const targetYear = target.year - yearsAgo;
      const assets = await this.memoryRepository.getMilestoneAssets(
        ownerId,
        targetYear,
        target.month,
        target.day,
      );
      if (assets.length >= 3) {
        await this.memoryRepository.create(
          {
            ownerId,
            type: MemoryType.MilestoneAnniversary,
            data: {
              yearsAgo,
              year: targetYear,
              title: yearsAgo === 1 ? '1 Year Anniversary' : `${yearsAgo} Years Milestone`,
              subtitle: `Celebrating moments from ${targetYear}`,
            },
            memoryAt: target.set({ year: targetYear }).toISO()!,
            showAt: target.startOf('day').toISO(),
            hideAt: target.endOf('day').toISO(),
          },
          new Set(assets.map(({ id }) => id)),
        );
        break;
      }
    }
  }

  private async createPeoplePetGrowthMemories(ownerId: string, target: DateTime) {
    const hasRecent = await this.memoryRepository.hasRecentMemory(
      ownerId,
      MemoryType.PeoplePetGrowth,
      target.minus({ days: 14 }).toISO()!,
    );
    if (hasRecent) {
      return;
    }

    const people = await this.memoryRepository.getPeopleForGrowthMemories(ownerId);
    if (people.length === 0) {
      return;
    }

    for (const person of people.slice(0, 2)) {
      const assets = await this.memoryRepository.getPersonGrowthAssets(ownerId, person.personGroupId);
      if (assets.length >= 4) {
        const name = person.name && person.name.trim() ? person.name : 'Loved One';
        await this.memoryRepository.create(
          {
            ownerId,
            type: MemoryType.PeoplePetGrowth,
            data: {
              personId: person.personGroupId,
              personName: name,
              year: target.year,
              yearsSpan: person.yearsCount,
              title: `${name} Through the Years`,
              subtitle: `Memories growing and changing across the years`,
            },
            memoryAt: target.toISO()!,
            showAt: target.startOf('day').toISO(),
            hideAt: target.plus({ days: 3 }).endOf('day').toISO(),
          },
          new Set(assets.map(({ id }) => id)),
        );
      }
    }
  }

  private async createTripEventMemories(ownerId: string, target: DateTime) {
    const hasRecent = await this.memoryRepository.hasRecentMemory(
      ownerId,
      MemoryType.TripEvent,
      target.minus({ days: 14 }).toISO()!,
    );
    if (hasRecent) {
      return;
    }

    const clusters = await this.memoryRepository.getTripEventClusters(ownerId);
    if (clusters.length === 0) {
      return;
    }

    for (const cluster of clusters.slice(0, 1)) {
      const assets = await this.memoryRepository.getAssetsByPlaceAndMonth(
        ownerId,
        cluster.place,
        cluster.year,
        cluster.month,
      );
      if (assets.length >= 4) {
        await this.memoryRepository.create(
          {
            ownerId,
            type: MemoryType.TripEvent,
            data: {
              locationName: cluster.place,
              city: cluster.place,
              year: cluster.year,
              title: `Trip to ${cluster.place}`,
              subtitle: `Highlights from your travels in ${cluster.year}`,
            },
            memoryAt: target.set({ year: cluster.year, month: cluster.month }).toISO()!,
            showAt: target.startOf('day').toISO(),
            hideAt: target.plus({ days: 3 }).endOf('day').toISO(),
          },
          new Set(assets.map(({ id }) => id)),
        );
      }
    }
  }

  private async createVisualPatternMemories(ownerId: string, target: DateTime) {
    const hasRecent = await this.memoryRepository.hasRecentMemory(
      ownerId,
      MemoryType.VisualPattern,
      target.minus({ days: 14 }).toISO()!,
    );
    if (hasRecent) {
      return;
    }

    const similarPairs = await this.memoryRepository.getVisualPatternSimilarAssets(ownerId);
    const assetIdSet = new Set<string>();
    for (const pair of similarPairs) {
      assetIdSet.add(pair.id1);
      assetIdSet.add(pair.id2);
      if (assetIdSet.size >= 12) {
        break;
      }
    }

    if (assetIdSet.size >= 3) {
      await this.memoryRepository.create(
        {
          ownerId,
          type: MemoryType.VisualPattern,
          data: {
            patternType: 'Harmonious Palette',
            year: target.year,
            title: 'Color & Harmony',
            subtitle: 'Photos that share subtle visual harmony',
          },
          memoryAt: target.toISO()!,
          showAt: target.startOf('day').toISO(),
          hideAt: target.plus({ days: 2 }).endOf('day').toISO(),
        },
        assetIdSet,
      );
      return;
    }

    const aestheticAssets = await this.memoryRepository.getAestheticAssets(ownerId, 12);
    if (aestheticAssets.length >= 4) {
      await this.memoryRepository.create(
        {
          ownerId,
          type: MemoryType.VisualPattern,
          data: {
            patternType: 'Visual Impressions',
            year: target.year,
            title: 'Visual Impressions',
            subtitle: 'Standout perspectives from your collection',
          },
          memoryAt: target.toISO()!,
          showAt: target.startOf('day').toISO(),
          hideAt: target.plus({ days: 2 }).endOf('day').toISO(),
        },
        new Set(aestheticAssets.map(({ id }) => id)),
      );
    }
  }

  private async createHolidayCelebrationMemories(ownerId: string, target: DateTime) {
    const holidays = [
      { name: 'New Year', startMonth: 12, startDay: 30, endMonth: 1, endDay: 2 },
      { name: "Valentine's Day", startMonth: 2, startDay: 13, endMonth: 2, endDay: 15 },
      { name: 'Independence Day', startMonth: 7, startDay: 3, endMonth: 7, endDay: 5 },
      { name: 'Halloween', startMonth: 10, startDay: 30, endMonth: 11, endDay: 1 },
      { name: 'Diwali', startMonth: 10, startDay: 20, endMonth: 11, endDay: 18 },
      { name: 'Thanksgiving', startMonth: 11, startDay: 20, endMonth: 11, endDay: 28 },
      { name: 'Christmas', startMonth: 12, startDay: 23, endMonth: 12, endDay: 26 },
      { name: 'Hanukkah', startMonth: 12, startDay: 10, endMonth: 12, endDay: 28 },
    ];

    for (const holiday of holidays) {
      const inWindow =
        holiday.startMonth === holiday.endMonth
          ? target.month === holiday.startMonth &&
            target.day >= holiday.startDay - 2 &&
            target.day <= holiday.endDay + 2
          : (target.month === holiday.startMonth && target.day >= holiday.startDay - 2) ||
            (target.month === holiday.endMonth && target.day <= holiday.endDay + 2);

      if (inWindow) {
        const assets = await this.memoryRepository.getHolidayAssets(
          ownerId,
          holiday.startMonth,
          holiday.startDay,
          holiday.endMonth,
          holiday.endDay,
        );
        if (assets.length >= 3) {
          await this.memoryRepository.create(
            {
              ownerId,
              type: MemoryType.HolidayCelebration,
              data: {
                holidayName: holiday.name,
                year: target.year,
                title: `${holiday.name} Memories`,
                subtitle: `Celebrating ${holiday.name} with friends and family`,
              },
              memoryAt: target.toISO()!,
              showAt: target.startOf('day').toISO(),
              hideAt: target.plus({ days: 3 }).endOf('day').toISO(),
            },
            new Set(assets.map(({ id }) => id)),
          );
          break;
        }
      }
    }
  }

  private async createAutomatedCreationMemories(ownerId: string, target: DateTime) {
    const hasRecent = await this.memoryRepository.hasRecentMemory(
      ownerId,
      MemoryType.CinematicMoments,
      target.minus({ days: 7 }).toISO()!,
    );
    if (!hasRecent) {
      const livePhotos = await this.memoryRepository.getLivePhotoAssets(ownerId, 15);
      if (livePhotos.length >= 3) {
        await this.memoryRepository.create(
          {
            ownerId,
            type: MemoryType.CinematicMoments,
            data: {
              effectType: 'Motion Photo',
              year: target.year,
              title: 'Cinematic Moments',
              subtitle: 'Living moments captured in motion',
            },
            memoryAt: target.toISO()!,
            showAt: target.startOf('day').toISO(),
            hideAt: target.plus({ days: 2 }).endOf('day').toISO(),
          },
          new Set(livePhotos.map(({ id }) => id)),
        );
      }
    }

    const hasRecentRemix = await this.memoryRepository.hasRecentMemory(
      ownerId,
      MemoryType.RemixCollage,
      target.minus({ days: 7 }).toISO()!,
    );
    if (!hasRecentRemix) {
      const burstAssets = await this.memoryRepository.getBurstAssets(ownerId, 15);
      if (burstAssets.length >= 3) {
        await this.memoryRepository.create(
          {
            ownerId,
            type: MemoryType.RemixCollage,
            data: {
              style: 'Action Burst',
              year: target.year,
              title: 'Burst & Collage',
              subtitle: 'Dynamic frames and styled sequences',
            },
            memoryAt: target.toISO()!,
            showAt: target.startOf('day').toISO(),
            hideAt: target.plus({ days: 2 }).endOf('day').toISO(),
          },
          new Set(burstAssets.map(({ id }) => id)),
        );
      }
    }

    const hasRecentStylized = await this.memoryRepository.hasRecentMemory(
      ownerId,
      MemoryType.StylizedPhoto,
      target.minus({ days: 7 }).toISO()!,
    );
    if (!hasRecentStylized) {
      const aestheticAssets = await this.memoryRepository.getAestheticAssets(ownerId, 10);
      if (aestheticAssets.length >= 3) {
        await this.memoryRepository.create(
          {
            ownerId,
            type: MemoryType.StylizedPhoto,
            data: {
              effect: 'Color Pop',
              year: target.year,
              title: 'Stylized Edits',
              subtitle: 'Artistic highlights curated from your best shots',
            },
            memoryAt: target.toISO()!,
            showAt: target.startOf('day').toISO(),
            hideAt: target.plus({ days: 2 }).endOf('day').toISO(),
          },
          new Set(aestheticAssets.map(({ id }) => id)),
        );
      }
    }
  }

  private async createCollaborativeMemories(ownerId: string, target: DateTime) {
    const hasRecent = await this.memoryRepository.hasRecentMemory(
      ownerId,
      MemoryType.Collaborative,
      target.minus({ days: 14 }).toISO()!,
    );
    if (hasRecent) {
      return;
    }

    const albums = await this.memoryRepository.getCollaborativeAlbumAssets(ownerId);
    if (albums.length === 0) {
      return;
    }

    for (const album of albums.slice(0, 1)) {
      const assets = await this.memoryRepository.getAssetsForAlbum(album.albumId);
      if (assets.length >= 3) {
        await this.memoryRepository.create(
          {
            ownerId,
            type: MemoryType.Collaborative,
            data: {
              albumId: album.albumId,
              albumName: album.albumName,
              year: target.year,
              title: `Shared: ${album.albumName}`,
              subtitle: 'Collaborative moments from friends and family',
            },
            memoryAt: target.toISO()!,
            showAt: target.startOf('day').toISO(),
            hideAt: target.plus({ days: 3 }).endOf('day').toISO(),
          },
          new Set(assets.map(({ id }) => id)),
        );
      }
    }
  }

  @OnJob({ name: JobName.MemoryCleanup, queue: QueueName.BackgroundTask })
  async onMemoriesCleanup() {
    await this.memoryRepository.cleanup();
  }

  async search(auth: AuthDto, dto: MemorySearchDto) {
    const memories = await this.memoryRepository.search(auth.user.id, dto);
    return memories
      .filter((memory: Memory) => memory.assets && memory.assets.length > 0)
      .map((memory: Memory) => mapMemory(memory, auth));
  }

  statistics(auth: AuthDto, dto: MemorySearchDto) {
    return this.memoryRepository.statistics(auth.user.id, dto);
  }

  async get(auth: AuthDto, id: string): Promise<MemoryResponseDto> {
    await this.requireAccess({ auth, permission: Permission.MemoryRead, ids: [id] });
    const memory = await this.findOrFail(id);
    return mapMemory(memory, auth);
  }

  async create(auth: AuthDto, dto: MemoryCreateDto) {
    const assetIds = dto.assetIds || [];
    const allowedAssetIds = await this.checkAccess({
      auth,
      permission: Permission.AssetUpdate,
      ids: assetIds,
    });
    const memory = await this.memoryRepository.create(
      {
        ownerId: auth.user.id,
        type: dto.type,
        data: dto.data,
        isSaved: dto.isSaved,
        memoryAt: dto.memoryAt,
        showAt: dto.showAt,
        hideAt: dto.hideAt,
        seenAt: dto.seenAt,
      },
      allowedAssetIds,
    );

    return mapMemory(memory, auth);
  }

  async update(auth: AuthDto, id: string, dto: MemoryUpdateDto): Promise<MemoryResponseDto> {
    await this.requireAccess({ auth, permission: Permission.MemoryUpdate, ids: [id] });

    const memory = await this.memoryRepository.update(id, {
      isSaved: dto.isSaved,
      memoryAt: dto.memoryAt,
      seenAt: dto.seenAt,
    });

    return mapMemory(memory, auth);
  }

  async remove(auth: AuthDto, id: string): Promise<void> {
    await this.requireAccess({ auth, permission: Permission.MemoryDelete, ids: [id] });
    await this.memoryRepository.delete(id);
  }

  async addAssets(auth: AuthDto, id: string, dto: BulkIdsDto): Promise<BulkIdResponseDto[]> {
    await this.requireAccess({ auth, permission: Permission.MemoryRead, ids: [id] });

    const repos = { access: this.accessRepository, bulk: this.memoryRepository };
    const results = await addAssets(auth, repos, {
      parentId: id,
      assetIds: dto.ids,
      permission: Permission.AssetUpdate,
    });

    const hasSuccess = results.some(({ success }) => success);
    if (hasSuccess) {
      await this.memoryRepository.update(id, { updatedAt: new Date() });
    }

    return results;
  }

  async removeAssets(auth: AuthDto, id: string, dto: BulkIdsDto): Promise<BulkIdResponseDto[]> {
    await this.requireAccess({ auth, permission: Permission.MemoryUpdate, ids: [id] });

    const repos = { access: this.accessRepository, bulk: this.memoryRepository };
    const results = await removeAssets(auth, repos, {
      parentId: id,
      assetIds: dto.ids,
      canAlwaysRemove: Permission.MemoryDelete,
    });

    const hasSuccess = results.some(({ success }) => success);
    if (hasSuccess) {
      await this.memoryRepository.update(id, { id, updatedAt: new Date() });
    }

    return results;
  }

  private findOrFail(id: string) {
    return findOrFail(() => this.memoryRepository.get(id), 'Memory');
  }
}
