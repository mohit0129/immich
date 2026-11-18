<script lang="ts">
  import { shortcut } from '#lib/actions/shortcut.ts';
  import { timeBeforeShowLoadingSpinner } from '#lib/constants.ts';
  import { assetViewerManager } from '#lib/managers/asset-viewer-manager.svelte.ts';
  import { authManager } from '#lib/managers/auth-manager.svelte.ts';
  import { createActivityMutation, deleteActivityMutation, getActivitiesQuery } from '#lib/queries/activity.query.ts';
  import { executeMutation } from '#lib/queries/client.ts';
  import { Route } from '#lib/route.ts';
  import { locale } from '#lib/stores/preferences.store.ts';
  import { getAssetMediaUrl } from '#lib/utils.ts';
  import { isTenMinutesApart } from '#lib/utils/timesince.ts';
  import { AssetTypeEnum, ReactionType, type ActivityResponseDto, type AlbumUserResponseDto } from '@immich/sdk';
  import { ContextMenuButton, Icon, IconButton, LoadingSpinner, Textarea } from '@immich/ui';
  import { mdiClose, mdiSend, mdiThumbUp, mdiTrashCanOutline } from '@mdi/js';
  import { createQuery } from '@tanstack/svelte-query';
  import * as luxon from 'luxon';
  import { t } from 'svelte-i18n';
  import { fromAction } from 'svelte/attachments';
  import UserAvatar from '../shared-components/UserAvatar.svelte';

  const units: Intl.RelativeTimeFormatUnit[] = ['year', 'month', 'week', 'day', 'hour', 'minute', 'second'];

  const shouldGroup = (currentDate: string, nextDate: string): boolean => {
    const currentDateTime = luxon.DateTime.fromISO(currentDate, { locale: $locale });
    const nextDateTime = luxon.DateTime.fromISO(nextDate, { locale: $locale });

    return currentDateTime.hasSame(nextDateTime, 'hour') || currentDateTime.toRelative() === nextDateTime.toRelative();
  };

  const timeSince = (dateTime: luxon.DateTime) => {
    const diff = dateTime.diffNow().shiftTo(...units);
    const unit = units.find((unit) => diff.get(unit) !== 0) || 'second';

    const relativeFormatter = new Intl.RelativeTimeFormat($locale, {
      numeric: 'auto',
    });
    return relativeFormatter.format(Math.trunc(diff.as(unit)), unit);
  };

  interface Props {
    assetId?: string | undefined;
    albumId: string;
    assetType?: AssetTypeEnum | undefined;
    albumUsers: AlbumUserResponseDto[];
    disabled: boolean;
  }

  let { assetId = undefined, albumId, assetType = undefined, albumUsers, disabled }: Props = $props();

  const query = createQuery(() => getActivitiesQuery({ albumId, assetId }));
  const activities = $derived(query.data ?? []);

  let innerHeight: number = $state(0);
  let activityHeight: number = $state(0);
  let chatHeight: number = $state(0);
  let divHeight = $derived(innerHeight - activityHeight);
  let previousAssetId: string | undefined = $state(assetId);
  let message = $state('');
  let isSendingMessage = $state(false);
  let scrollContainer: HTMLElement | undefined = $state();
  let hasScrolledToBottom = false;
  const isAlbumOwner = $derived(albumUsers[0].user.id === authManager.user.id);
  const quickEmojis = ['❤️', '👍', '👎', '🎉', '🔥', '😂'];

  const handleSendEmoji = async (emoji: string) => {
    if (disabled) return;
    await executeMutation(
      createActivityMutation,
      [{ activityCreateDto: { albumId, assetId, type: ReactionType.Comment, comment: emoji } }],
    );
  };

  const timeOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  };

  const handleDeleteReaction = (reaction: ActivityResponseDto) => {
    const successToast = reaction.type === ReactionType.Comment ? 'comment_deleted' : 'like_deleted';
    return executeMutation(
      () =>
        deleteActivityMutation({
          success: { toast: successToast },
          error: { toast: 'errors.unable_to_remove_reaction' },
        }),
      [{ id: reaction.id }],
    );
  };

  const handleSendComment = async () => {
    if (!message) {
      return;
    }
    const timeout = setTimeout(() => (isSendingMessage = true), timeBeforeShowLoadingSpinner);
    await executeMutation(
      createActivityMutation,
      [{ activityCreateDto: { albumId, assetId, type: ReactionType.Comment, comment: message } }],
      { onSuccess: () => (message = '') },
    );
    clearTimeout(timeout);
    isSendingMessage = false;
  };

  $effect(() => {
    if (assetId && previousAssetId !== assetId) {
      previousAssetId = assetId;
      hasScrolledToBottom = false;
    }
  });

  $effect(() => {
    if (scrollContainer && activities.length > 0 && !hasScrolledToBottom) {
      hasScrolledToBottom = true;
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  });

  const onsubmit = async (event: Event) => {
    event.preventDefault();
    await handleSendComment();
  };
</script>

{#snippet reactionMenu(reaction: ActivityResponseDto, title: string)}
  {#if reaction.user.id === authManager.user.id || isAlbumOwner}
    <ContextMenuButton
      translations={{ open_menu: title }}
      position="top-right"
      class="shrink-0"
      size="small"
      items={[
        {
          icon: mdiTrashCanOutline,
          title: $t('remove'),
          color: 'danger',
          onAction: () => handleDeleteReaction(reaction),
        },
      ]}
    />
  {/if}
{/snippet}

<div class="relative h-full overflow-y-hidden border-l border-subtle bg-subtle" bind:offsetHeight={innerHeight}>
  <div class="size-full">
    <div class="flex h-fit w-full bg-subtle p-2 dark:text-immich-dark-fg" bind:clientHeight={activityHeight}>
      <div class="flex place-items-center gap-2">
        <IconButton
          shape="round"
          variant="ghost"
          color="secondary"
          onclick={() => assetViewerManager.closeActivityPanel()}
          icon={mdiClose}
          aria-label={$t('close')}
        />

        <p class="text-lg text-immich-fg dark:text-immich-dark-fg">{$t('activity')}</p>
      </div>
    </div>
    {#if innerHeight}
      <div
        bind:this={scrollContainer}
        class="relative w-full immich-scrollbar overflow-y-auto px-2"
        style="height: {divHeight}px;padding-bottom: {chatHeight}px"
      >
        {#each activities as reaction, index (reaction.id)}
          {#if reaction.type === ReactionType.Comment}
            <div class="mt-3 flex justify-start gap-3 rounded-xl bg-gray-200/90 p-3 dark:bg-gray-800">
              <div class="flex items-start pt-0.5">
                <UserAvatar user={reaction.user} size="sm" />
              </div>

              <div class="w-full flex-1 overflow-hidden">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-xs font-semibold text-immich-fg dark:text-immich-dark-fg">
                    {reaction.user.name}
                  </span>
                  <span class="text-[11px] text-gray-500 dark:text-gray-400">
                    {timeSince(luxon.DateTime.fromISO(reaction.createdAt, { locale: $locale }))}
                  </span>
                </div>
                {#if quickEmojis.includes(reaction.comment || '')}
                  <div class="mt-1 flex items-center gap-2">
                    <span class="text-2xl">{reaction.comment}</span>
                    <span class="text-xs text-gray-500 dark:text-gray-400">reacted {reaction.comment}</span>
                  </div>
                {:else}
                  <div class="mt-1 text-sm/5 wrap-break-word text-immich-fg dark:text-immich-dark-fg">
                    {reaction.comment}
                  </div>
                {/if}
              </div>

              {#if assetId === undefined && reaction.assetId}
                <a class="aspect-square size-14 shrink-0 overflow-hidden rounded-lg" href={Route.viewAlbumAsset({ albumId, assetId: reaction.assetId })}>
                  <img
                    class="size-14 rounded-lg object-cover"
                    src={getAssetMediaUrl({ id: reaction.assetId })}
                    alt="Asset preview"
                  />
                </a>
              {/if}
              {@render reactionMenu(reaction, $t('comment_options'))}
            </div>

            {#if (index !== activities.length - 1 && !shouldGroup(activities[index].createdAt, activities[index + 1].createdAt)) || index === activities.length - 1}
              <div
                class="w-full px-2 pt-1 text-right text-xs text-gray-500 dark:text-gray-400"
                title={new Date(reaction.createdAt).toLocaleDateString(undefined, timeOptions)}
              >
                {timeSince(luxon.DateTime.fromISO(reaction.createdAt, { locale: $locale }))}
              </div>
            {/if}
          {:else if reaction.type === ReactionType.Like}
            {const type = $derived(
              assetType === AssetTypeEnum.Image || assetType === AssetTypeEnum.Video ? assetType.toLowerCase() : null,
            )}
            <div class="relative mt-2 flex items-center justify-between rounded-xl bg-gray-100/70 p-2.5 dark:bg-gray-800/50">
              <div class="flex items-center gap-2.5">
                <UserAvatar user={reaction.user} size="xs" />
                <div class="flex items-center gap-1.5 text-xs">
                  <span class="font-semibold text-immich-fg dark:text-immich-dark-fg">{reaction.user.name}</span>
                  <span class="text-gray-500">liked this</span>
                  <span class="text-primary"><Icon icon={mdiThumbUp} size="16" /></span>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-[11px] text-gray-500 dark:text-gray-400">
                  {timeSince(luxon.DateTime.fromISO(reaction.createdAt, { locale: $locale }))}
                </span>
                {#if assetId === undefined && reaction.assetId}
                  <a class="aspect-square size-10 shrink-0 overflow-hidden rounded-lg" href={Route.viewAlbumAsset({ albumId, assetId: reaction.assetId })}>
                    <img
                      class="size-10 rounded-lg object-cover"
                      src={getAssetMediaUrl({ id: reaction.assetId })}
                      alt="Asset preview"
                    />
                  </a>
                {/if}
                {@render reactionMenu(reaction, $t('reaction_options'))}
              </div>
            </div>
          {/if}
        {/each}
      </div>
    {/if}
  </div>

  <div class="absolute bottom-0 w-full">
    <div class="flex flex-col gap-1.5 p-2" bind:clientHeight={chatHeight}>
      {#if !disabled}
        <div class="flex items-center justify-center gap-1 rounded-2xl bg-gray-200/70 p-1 dark:bg-gray-800/70">
          {#each quickEmojis as emoji}
            <button
              type="button"
              class="flex size-8 items-center justify-center rounded-full text-base transition-transform hover:scale-125 hover:bg-white/60 dark:hover:bg-white/10 active:scale-95"
              onclick={() => handleSendEmoji(emoji)}
              title={`React ${emoji}`}
            >
              {emoji}
            </button>
          {/each}
        </div>
      {/if}
      <div class="flex h-fit w-full gap-3 rounded-3xl bg-gray-200 p-2 text-immich-dark-gray dark:bg-gray-800">
        <div>
          <UserAvatar user={authManager.user} size="md" noTitle />
        </div>
        <form class="flex max-h-56 w-full items-center gap-1" {onsubmit}>
          <Textarea
            {disabled}
            bind:value={message}
            rows={1}
            grow
            placeholder={disabled ? $t('comments_are_disabled') : $t('say_something')}
            {@attach fromAction(shortcut, () => ({
              shortcut: { key: 'Enter' },
              onShortcut: () => handleSendComment(),
            }))}
            class="{disabled
              ? 'cursor-not-allowed'
              : ''} max-h-56 w-full resize-none items-center overflow-y-auto bg-gray-200 pe-2 leading-4 ring-0! outline-none dark:bg-gray-200"
          />
          {#if isSendingMessage}
            <div class="ms-0 flex place-items-center pb-2">
              <div class="flex w-full place-items-center">
                <LoadingSpinner size="large" />
              </div>
            </div>
          {:else if message}
            <div class="light ms-0 flex w-fit items-center">
              <IconButton
                shape="round"
                aria-label={$t('send_message')}
                variant="ghost"
                icon={mdiSend}
                onclick={() => handleSendComment()}
              />
            </div>
          {/if}
        </form>
      </div>
    </div>
  </div>
</div>

<style>
  ::placeholder {
    color: rgb(60, 60, 60);
    opacity: 0.6;
  }

  ::-ms-input-placeholder {
    /* Edge 12 -18 */
    color: white;
  }
</style>
