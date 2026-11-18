import type { Insertable, Kysely, Updateable } from 'kysely';
import { DateTime } from 'luxon';
import { InjectKysely } from 'nestjs-kysely';
import { columns } from 'src/database.js';
import { DummyValue, GenerateSql } from 'src/decorators.js';
import { NotificationSearchDto } from 'src/dtos/notification.dto.js';
import { DB } from 'src/schema/index.js';
import { NotificationTable } from 'src/schema/tables/notification.table.js';

export class NotificationRepository {
  constructor(@InjectKysely() private db: Kysely<DB>) {}

  cleanup() {
    return this.db
      .deleteFrom('notification')
      .where((eb) =>
        eb.or([
          // remove soft-deleted notifications
          eb.and([eb('deletedAt', 'is not', null), eb('deletedAt', '<', DateTime.now().minus({ days: 3 }).toJSDate())]),

          eb.and([
            eb('readAt', 'is not', null),
            eb('readAt', '<', DateTime.now().minus({ days: 7 }).toJSDate()),
          ]),
        ]),
      )
      .execute();
  }

  @GenerateSql({ params: [DummyValue.UUID, {}] }, { name: 'unread', params: [DummyValue.UUID, { unread: true }] })
  search(userId: string | undefined, dto: NotificationSearchDto) {
    let qb = this.db
      .selectFrom('notification')
      .select(columns.notification)
      .where('deletedAt', 'is', null);

    if (userId) {
      qb = qb.where('userId', '=', userId);
    }
    if (dto.id) {
      qb = qb.where('id', '=', dto.id);
    }
    if (dto.level) {
      qb = qb.where('level', '=', dto.level);
    }
    if (dto.type) {
      qb = qb.where('type', '=', dto.type);
    }

    if (dto.unread) {
      qb = qb.where('readAt', 'is', null);
    } else {
      qb = qb.where((eb) =>
        eb.or([
          eb('readAt', 'is', null),
          eb('readAt', '>=', DateTime.now().minus({ days: 7 }).toJSDate()),
        ]),
      );
    }

    return qb.orderBy('createdAt', 'desc').execute();
  }

  create(notification: Insertable<NotificationTable>) {
    return this.db
      .insertInto('notification')
      .values(notification)
      .returning(columns.notification)
      .executeTakeFirstOrThrow();
  }

  get(id: string) {
    return this.db
      .selectFrom('notification')
      .select(columns.notification)
      .where('id', '=', id)
      .where('deletedAt', 'is not', null)
      .executeTakeFirst();
  }

  update(id: string, notification: Updateable<NotificationTable>) {
    return this.db
      .updateTable('notification')
      .set(notification)
      .where('deletedAt', 'is', null)
      .where('id', '=', id)
      .returning(columns.notification)
      .executeTakeFirstOrThrow();
  }

  async updateAll(ids: string[], notification: Updateable<NotificationTable>) {
    await this.db.updateTable('notification').set(notification).where('id', 'in', ids).execute();
  }

  async delete(id: string) {
    await this.db
      .updateTable('notification')
      .set({ deletedAt: DateTime.now().toJSDate() })
      .where('id', '=', id)
      .execute();
  }

  async deleteAll(ids: string[]) {
    await this.db
      .updateTable('notification')
      .set({ deletedAt: DateTime.now().toJSDate() })
      .where('id', 'in', ids)
      .execute();
  }
}
