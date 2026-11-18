<script lang="ts">
  import AdminPageLayout from '#lib/components/layouts/AdminPageLayout.svelte';
  import SendNotificationModal from '#lib/modals/SendNotificationModal.svelte';
  import { createPreloadedQuery } from '#lib/queries/client.ts';
  import { searchUsersAdminQuery } from '#lib/queries/user-admin.query.ts';
  import { Route } from '#lib/route.ts';
  import { getUserAdminActions, getUserAdminsActions } from '#lib/services/user-admin.service.ts';
  import { locale } from '#lib/stores/preferences.store.ts';
  import { getByteUnitString } from '#lib/utils/byte-units.ts';
  import type { UserAdminResponseDto } from '@immich/sdk';
  import {
    CommandPaletteDefaultProvider,
    Container,
    ContextMenuButton,
    Icon,
    Link,
    MenuItemType,
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableHeading,
    TableRow,
    modalManager,
    type ActionItem,
  } from '@immich/ui';
  import { mdiBellOutline, mdiInfinity } from '@mdi/js';
  import type { Snippet } from 'svelte';
  import { t } from 'svelte-i18n';
  import type { LayoutData } from './$types';

  type Props = {
    children?: Snippet;
    data: LayoutData;
  };

  let { children, data }: Props = $props();

  const query = createPreloadedQuery(() => searchUsersAdminQuery({ withDeleted: true }));
  const users = $derived(query.data);

  const { Create } = $derived(getUserAdminsActions($t));

  const SendNotification = $derived<ActionItem>({
    title: $t('send_notification'),
    icon: mdiBellOutline,
    onAction: () => modalManager.show(SendNotificationModal, { users: users ?? [] }),
  });

  const getActionsForUser = (user: UserAdminResponseDto) => {
    const { Detail, Update, AdjustQuota, Delete, Restore, ResetPassword, ResetPinCode, Suspend, Unsuspend } =
      getUserAdminActions($t, user);
    return [
      Detail,
      Update,
      AdjustQuota,
      ResetPassword,
      ResetPinCode,
      MenuItemType.Divider,
      Suspend,
      Unsuspend,
      MenuItemType.Divider,
      Restore,
      Delete,
    ];
  };

  const classes = {
    column1: 'w-8/12 md:w-5/12 lg:w-4/12',
    column2: 'hidden md:block md:w-5/12 lg:w-4/12',
    column3: 'hidden lg:block lg:w-2/12',
    column4: 'w-4/12 md:w-2/12 flex justify-end',
  };
</script>

<CommandPaletteDefaultProvider name={$t('users')} actions={[Create, SendNotification]} />

<AdminPageLayout breadcrumbs={[{ title: data.meta.title }]} actions={[Create, SendNotification]}>
  <Container center size="large">
    <Table class="mt-4" striped spacing="small" size="small">
      <TableHeader>
        <TableHeading class={classes.column1}>{$t('name')}</TableHeading>
        <TableHeading class={classes.column2}>{$t('email')}</TableHeading>
        <TableHeading class={classes.column3}>{$t('has_quota')}</TableHeading>
      </TableHeader>

      <TableBody>
        {#each users as user (user.id)}
          <TableRow color={user.deletedAt ? 'danger' : (user.status as any) === 'suspended' ? 'warning' : undefined}>
            <TableCell class={classes.column1}>
              <div class="flex items-center gap-2">
                <Link href={Route.viewUser(user)}>{user.name}</Link>
                {#if (user.status as any) === 'suspended'}
                  <span class="rounded bg-amber-500/20 px-1.5 py-0.5 text-xs font-semibold text-amber-500">
                    {$t('suspend')}ed
                  </span>
                {/if}
              </div>
            </TableCell>
            <TableCell class={classes.column2}>{user.email}</TableCell>
            <TableCell class={classes.column3}>
              <div class="container mx-auto flex flex-wrap justify-center">
                {#if user.quotaSizeInBytes !== null && user.quotaSizeInBytes >= 0}
                  {getByteUnitString(user.quotaSizeInBytes, $locale)}
                {:else}
                  <Icon icon={mdiInfinity} size="16" />
                {/if}
              </div>
            </TableCell>
            <TableCell class={classes.column4}>
              <ContextMenuButton color="primary" aria-label={$t('open')} items={getActionsForUser(user)} />
            </TableCell>
          </TableRow>
        {/each}
      </TableBody>
    </Table>

    {@render children?.()}
  </Container>
</AdminPageLayout>
