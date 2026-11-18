import { queryClient } from '#lib/queries/client.ts';
import { getNotificationsQuery } from '#lib/queries/notification.query.ts';
import { searchUsersAdminQuery } from '#lib/queries/user-admin.query.ts';
import { authenticate } from '#lib/utils/auth.ts';
import { getFormatter } from '#lib/utils/i18n.ts';
import type { PageLoad } from './$types';

export const load = (async ({ url }) => {
  await authenticate(url, { admin: true });
  await queryClient.query(searchUsersAdminQuery());
  await queryClient.query(getNotificationsQuery());
  const $t = await getFormatter();

  return {
    meta: {
      title: $t('notifications'),
    },
  };
}) satisfies PageLoad;

