import { BadRequestException, Injectable } from '@nestjs/common';
import { AuthDto } from 'src/dtos/auth.dto.js';
import { SystemConfigSmtpDto } from 'src/dtos/config.dto.js';
import { NotificationCreateDto, NotificationSearchDto, mapNotification } from 'src/dtos/notification.dto.js';
import { NotificationLevel, NotificationType, UserStatus } from 'src/enum.js';
import { EmailTemplate } from 'src/repositories/email.repository.js';
import { BaseService } from 'src/services/base.service.js';
import { getExternalDomain } from 'src/utils/misc.js';

@Injectable()
export class NotificationAdminService extends BaseService {
  async create(auth: AuthDto, dto: NotificationCreateDto) {
    let targetUserIds: string[] = [];

    if (dto.allUsers) {
      const users = await this.userRepository.getList({ withDeleted: false });
      targetUserIds = users.filter((u) => u.status === UserStatus.Active).map((u) => u.id);
    } else if (dto.userIds && dto.userIds.length > 0) {
      targetUserIds = dto.userIds;
    } else if (dto.userId) {
      targetUserIds = [dto.userId];
    }

    if (targetUserIds.length === 0) {
      throw new BadRequestException('No recipients specified for notification');
    }

    let lastCreated: any = null;
    for (const userId of targetUserIds) {
      const item = await this.notificationRepository.create({
        userId,
        type: dto.type ?? NotificationType.Custom,
        level: dto.level ?? NotificationLevel.Info,
        title: dto.title,
        description: dto.description,
        data: dto.data,
      });
      lastCreated = item;
      this.websocketRepository.clientSend('on_notification', userId, mapNotification(item));
    }

    return mapNotification(lastCreated);
  }

  async search(dto: NotificationSearchDto = {}) {
    const items = await this.notificationRepository.search(undefined, dto);
    return items.map((item) => mapNotification(item));
  }

  async delete(id: string) {
    await this.notificationRepository.delete(id);
  }

  async sendTestEmail(id: string, dto: SystemConfigSmtpDto, tempTemplate?: string) {
    const user = await this.userRepository.get(id, { withDeleted: false });
    if (!user) {
      throw new Error('User not found');
    }

    try {
      await this.emailRepository.verifySmtp(dto.transport);
    } catch (error) {
      throw new BadRequestException('Failed to verify SMTP configuration', { cause: error });
    }

    const { server } = await this.getConfig({ withCache: false });
    const { html, text } = await this.emailRepository.renderEmail({
      template: EmailTemplate.TEST_EMAIL,
      data: {
        baseUrl: getExternalDomain(server),
        displayName: user.name,
      },
      customTemplate: tempTemplate!,
    });
    const { messageId } = await this.emailRepository.sendEmail({
      to: user.email,
      subject: 'Test email from Immich',
      html,
      text,
      from: dto.from,
      replyTo: dto.replyTo || dto.from,
      smtp: dto.transport,
    });

    return { messageId };
  }

  async getTemplate(name: EmailTemplate, customTemplate: string) {
    const { server, templates } = await this.getConfig({ withCache: false });

    let templateResponse: string;

    switch (name) {
      case EmailTemplate.WELCOME: {
        const { html: _welcomeHtml } = await this.emailRepository.renderEmail({
          template: EmailTemplate.WELCOME,
          data: {
            baseUrl: getExternalDomain(server),
            displayName: 'John Doe',
            username: 'john@doe.com',
            password: 'thisIsAPassword123',
          },
          customTemplate: customTemplate || templates.email.welcomeTemplate,
        });

        templateResponse = _welcomeHtml;
        break;
      }
      case EmailTemplate.ALBUM_UPDATE: {
        const { html: _updateAlbumHtml } = await this.emailRepository.renderEmail({
          template: EmailTemplate.ALBUM_UPDATE,
          data: {
            baseUrl: getExternalDomain(server),
            albumId: '1',
            albumName: 'Favorite Photos',
            recipientName: 'Jane Doe',
            cid: undefined,
          },
          customTemplate: customTemplate || templates.email.albumInviteTemplate,
        });
        templateResponse = _updateAlbumHtml;
        break;
      }

      case EmailTemplate.ALBUM_INVITE: {
        const { html } = await this.emailRepository.renderEmail({
          template: EmailTemplate.ALBUM_INVITE,
          data: {
            baseUrl: getExternalDomain(server),
            albumId: '1',
            albumName: "John Doe's Favorites",
            senderName: 'John Doe',
            recipientName: 'Jane Doe',
            cid: undefined,
          },
          customTemplate: customTemplate || templates.email.albumInviteTemplate,
        });
        templateResponse = html;
        break;
      }
      default: {
        templateResponse = '';
        break;
      }
    }

    return { name, html: templateResponse };
  }
}
