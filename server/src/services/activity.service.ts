import { Injectable } from '@nestjs/common';
import { Activity } from 'src/database.js';
import {
  ActivityCreateDto,
  ActivityDto,
  ActivityResponseDto,
  ActivitySearchDto,
  ActivityStatisticsResponseDto,
  MaybeDuplicate,
  ReactionLevel,
  ReactionType,
  mapActivity,
} from 'src/dtos/activity.dto.js';
import { AuthDto } from 'src/dtos/auth.dto.js';
import { mapNotification } from 'src/dtos/notification.dto.js';
import { NotificationLevel, NotificationType, Permission } from 'src/enum.js';
import { BaseService } from 'src/services/base.service.js';

@Injectable()
export class ActivityService extends BaseService {
  async getAll(auth: AuthDto, dto: ActivitySearchDto): Promise<ActivityResponseDto[]> {
    await this.requireAccess({ auth, permission: Permission.AlbumRead, ids: [dto.albumId] });
    const activities = await this.activityRepository.search({
      userId: dto.userId,
      albumId: dto.albumId,
      assetId: dto.level === ReactionLevel.ALBUM ? null : dto.assetId,
      isLiked: dto.type && dto.type === ReactionType.LIKE,
    });

    return activities.map((activity) => mapActivity(activity));
  }

  async getStatistics(auth: AuthDto, dto: ActivityDto): Promise<ActivityStatisticsResponseDto> {
    await this.requireAccess({ auth, permission: Permission.AlbumRead, ids: [dto.albumId] });
    return await this.activityRepository.getStatistics({ albumId: dto.albumId, assetId: dto.assetId });
  }

  async create(auth: AuthDto, dto: ActivityCreateDto): Promise<MaybeDuplicate<ActivityResponseDto>> {
    await this.requireAccess({ auth, permission: Permission.ActivityCreate, ids: [dto.albumId] });

    const common = {
      userId: auth.user.id,
      assetId: dto.assetId,
      albumId: dto.albumId,
    };

    let activity: Activity | undefined;
    let isDuplicate = false;

    if (dto.type === ReactionType.LIKE) {
      delete dto.comment;
      [activity] = await this.activityRepository.search({
        ...common,
        // `null` will search for an album like
        assetId: dto.assetId ?? null,
        isLiked: true,
      });
      isDuplicate = !!activity;
    }

    if (!activity) {
      activity = await this.activityRepository.create({
        ...common,
        isLiked: dto.type === ReactionType.LIKE,
        comment: dto.comment,
      });

      try {
        const album = await this.albumRepository.getById(dto.albumId);
        if (album) {
          const albumUsers = album.albumUsers ?? [];
          const isEmoji = !!dto.comment && ['❤️', '👍', '👎', '🎉', '🔥', '😂'].includes(dto.comment.trim());
          const isLike = dto.type === ReactionType.LIKE;
          const isReaction = isLike || isEmoji;
          const actionText = isReaction
            ? `reacted ${isLike ? '👍' : dto.comment} to`
            : `commented "${dto.comment?.slice(0, 50)}" on`;
          const targetText = dto.assetId ? `a photo in ${album.albumName}` : `album ${album.albumName}`;
          const title = isReaction ? 'New Reaction' : 'New Comment';
          const description = `${auth.user.name} ${actionText} ${targetText}`;

          for (const member of albumUsers) {
            const memberUserId = member.user?.id;
            if (memberUserId && memberUserId !== auth.user.id) {
              const notif = await this.notificationRepository.create({
                userId: memberUserId,
                type: NotificationType.AlbumUpdate,
                level: NotificationLevel.Info,
                title,
                description,
                data: JSON.stringify({
                  albumId: album.id,
                  assetId: dto.assetId ?? null,
                  actorName: auth.user.name,
                  isReaction,
                  isComment: !isReaction,
                  emoji: isEmoji ? dto.comment : isLike ? '👍' : null,
                  comment: dto.comment ?? null,
                }),
              });
              this.websocketRepository.clientSend('on_notification', memberUserId, mapNotification(notif));
            }
          }
        }
      } catch (err) {
        this.logger.error(`Failed to send activity notification: ${err}`);
      }
    }

    return { duplicate: isDuplicate, value: mapActivity(activity) };
  }

  async delete(auth: AuthDto, id: string): Promise<void> {
    await this.requireAccess({ auth, permission: Permission.ActivityDelete, ids: [id] });
    await this.activityRepository.delete(id);
  }
}
