<script lang="ts">
  import { locale } from '#lib/stores/preferences.store.ts';
  import type { SessionResponseDto } from '@immich/sdk';
  import { Icon, IconButton } from '@immich/ui';
  import {
    mdiAndroid,
    mdiApple,
    mdiAppleSafari,
    mdiCast,
    mdiClockOutline,
    mdiGoogleChrome,
    mdiHelp,
    mdiLinux,
    mdiMapMarkerOutline,
    mdiMicrosoftWindows,
    mdiTrashCanOutline,
    mdiUbuntu,
  } from '@mdi/js';
  import { DateTime } from 'luxon';
  import { t } from 'svelte-i18n';

  interface Props {
    session: SessionResponseDto;
    onDelete?: (() => void) | undefined;
  }

  const { session, onDelete = undefined }: Props = $props();

  const [osName, location] = $derived.by(() => {
    if (session.deviceOS && session.deviceOS.includes(' • ')) {
      const parts = session.deviceOS.split(' • ');
      return [parts[0].trim(), parts.slice(1).join(' • ').trim()];
    }
    return [session.deviceOS || '', ''];
  });
</script>

<div class="flex w-full flex-row items-start gap-3 py-1">
  <div class="hidden items-center justify-center pt-1 text-primary sm:flex">
    {#if osName.includes('Android') || session.deviceOS.includes('Android')}
      <Icon icon={mdiAndroid} size="40" />
    {:else if osName.includes('iOS') || osName.includes('macOS') || osName.includes('Apple') || session.deviceOS.includes('iOS') || session.deviceOS.includes('macOS')}
      <Icon icon={mdiApple} size="40" />
    {:else if osName.includes('Safari') || session.deviceType.includes('Safari')}
      <Icon icon={mdiAppleSafari} size="40" />
    {:else if osName.includes('Windows') || session.deviceOS.includes('Windows')}
      <Icon icon={mdiMicrosoftWindows} size="40" />
    {:else if osName.includes('Ubuntu')}
      <Icon icon={mdiUbuntu} size="40" />
    {:else if osName.includes('Linux')}
      <Icon icon={mdiLinux} size="40" />
    {:else if osName.includes('Chrome') || session.deviceType.includes('Chrome') || session.deviceType.includes('Chromium')}
      <Icon icon={mdiGoogleChrome} size="40" />
    {:else if osName.includes('Cast')}
      <Icon icon={mdiCast} size="40" />
    {:else}
      <Icon icon={mdiHelp} size="40" />
    {/if}
  </div>
  <div class="flex grow flex-row justify-between gap-2">
    <div class="flex flex-col justify-center gap-1.5 dark:text-white">
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {session.deviceType || osName || $t('unknown')}
        </span>
        {#if session.current}
          <span
            class="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"
          >
            {$t('current_device')}
          </span>
        {/if}
        {#if osName}
          <span
            class="rounded border border-gray-200 bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
          >
            {osName}
          </span>
        {/if}
        {#if session.appVersion}
          <span
            class="rounded border border-gray-200 bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
          >
            v{session.appVersion}
          </span>
        {/if}
      </div>

      {#if location}
        <div class="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
          <Icon icon={mdiMapMarkerOutline} size="14" class="text-primary" />
          <span>{location}</span>
        </div>
      {/if}

      <div class="flex flex-col gap-0.5 text-xs text-gray-500 dark:text-gray-400">
        <div class="flex flex-wrap items-center gap-1">
          <Icon icon={mdiClockOutline} size="13" class="text-gray-400" />
          <span class="font-medium text-gray-700 dark:text-gray-300">{$t('last_seen')}:</span>
          <span class="text-gray-900 dark:text-gray-200"
            >{DateTime.fromISO(session.updatedAt, { locale: $locale }).toRelative()}</span
          >
          <span class="text-gray-400">•</span>
          <span>
            {DateTime.fromISO(session.updatedAt, { locale: $locale }).toLocaleString(DateTime.DATETIME_MED, {
              locale: $locale,
            })}
          </span>
        </div>
        {#if session.createdAt}
          <div class="text-[11px] text-gray-400 dark:text-gray-500 ps-4">
            First signed in: {DateTime.fromISO(session.createdAt, { locale: $locale }).toLocaleString(
              DateTime.DATETIME_MED,
              { locale: $locale },
            )} ({DateTime.fromISO(session.createdAt, { locale: $locale }).toRelative()})
          </div>
        {/if}
      </div>
    </div>
    {#if !session.current && onDelete}
      <div class="shrink-0 self-center">
        <IconButton
          color="danger"
          variant="ghost"
          shape="round"
          icon={mdiTrashCanOutline}
          aria-label={$t('log_out')}
          size="small"
          onclick={onDelete}
        />
      </div>
    {/if}
  </div>
</div>
