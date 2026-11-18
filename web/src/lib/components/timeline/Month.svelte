<script lang="ts">
  import AssetLayout from '#lib/components/timeline/AssetLayout.svelte';
  import type { VirtualScrollManager } from '#lib/managers/VirtualScrollManager/VirtualScrollManager.svelte.ts';
  import type { AssetMultiSelectManager } from '#lib/managers/asset-multi-select-manager.svelte.ts';
  import { TimelineDay } from '#lib/managers/timeline-manager/timeline-day.svelte.ts';
  import type { TimelineMonth } from '#lib/managers/timeline-manager/timeline-month.svelte.ts';
  import type { TimelineAsset } from '#lib/managers/timeline-manager/types.ts';
  import { assetsSnapshot, filterIsInOrNearViewport } from '#lib/managers/timeline-manager/utils.svelte.ts';
  import { uploadAssetsStore } from '#lib/stores/upload.ts';
  import type { CommonPosition } from '#lib/utils/layout-utils.ts';
  import { fromTimelinePlainDate, getDateLocaleString } from '#lib/utils/timeline-util.ts';
  import { Icon } from '@immich/ui';
  import { mdiCheckCircle, mdiCircleOutline } from '@mdi/js';
  import type { Snippet } from 'svelte';

  type Props = {
    thumbnail: Snippet<
      [
        {
          asset: TimelineAsset;
          position: CommonPosition;
          timelineDay: TimelineDay;
          groupIndex: number;
        },
      ]
    >;
    customThumbnailLayout?: Snippet<[TimelineAsset]>;
    singleSelect: boolean;
    assetInteraction: AssetMultiSelectManager;
    timelineMonth: TimelineMonth;
    manager: VirtualScrollManager;
    timeGranularity?: 'day' | 'month' | 'year';
    onTimelineDaySelect: (timelineDay: TimelineDay, assets: TimelineAsset[]) => void;
  };
  let {
    thumbnail: thumbnailWithGroup,
    customThumbnailLayout,
    singleSelect,
    assetInteraction,
    timelineMonth,
    manager,
    timeGranularity = 'day',
    onTimelineDaySelect,
  }: Props = $props();

  let { isUploading } = uploadAssetsStore;
  let hoveredTimelineDay = $state<string | null>(null);

  const transitionDuration = $derived(timelineMonth.timelineManager.suspendTransitions && !$isUploading ? 0 : 150);

  const getTimelineDayFullDate = (timelineDay: TimelineDay): string => {
    const { month, year } = timelineDay.timelineMonth.yearMonth;
    const date = fromTimelinePlainDate({
      year,
      month,
      day: timelineDay.day,
    });
    return getDateLocaleString(date);
  };
</script>

{#each filterIsInOrNearViewport(timelineMonth.timelineDays) as timelineDay, groupIndex (timelineDay.day)}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <section
    class={[{ 'transition-all': !timelineMonth.timelineManager.suspendTransitions }]}
    style:transition-delay={timelineMonth.timelineManager.suspendTransitions ? undefined : `${transitionDuration}ms`}
    data-testid="timeline-day"
    style:position="absolute"
    style:inset-inline-start={timelineDay.start + 'px'}
    style:top={timelineDay.top + 'px'}
    onmouseenter={() => (hoveredTimelineDay = timelineDay.groupTitle)}
    onmouseleave={() => (hoveredTimelineDay = null)}
  >
    <div
      class="flex items-center text-xs font-medium text-immich-fg md:text-sm dark:text-immich-dark-fg select-none overflow-hidden px-1"
      style:height={timelineMonth.timelineManager.headerHeight + 'px'}
      style:width={timelineDay.width + 'px'}
    >
      {#if !singleSelect && timeGranularity === 'day'}
        {const isTimelineDaySelected = $derived(assetInteraction.selectedGroup.has(timelineDay.groupTitle))}
        <div
          class="w-0 overflow-hidden transition-all duration-200 ease-out hover:cursor-pointer flex items-center justify-center shrink-0"
          class:w-7={hoveredTimelineDay === timelineDay.groupTitle || isTimelineDaySelected}
          data-testid="select-day"
          onclick={() => onTimelineDaySelect(timelineDay, assetsSnapshot(timelineDay.getAssets()))}
          onkeydown={() => onTimelineDaySelect(timelineDay, assetsSnapshot(timelineDay.getAssets()))}
        >
          {#if isTimelineDaySelected}
            <Icon icon={mdiCheckCircle} size="20" class="text-primary" />
          {:else}
            <Icon icon={mdiCircleOutline} size="20" class="text-light-500" />
          {/if}
        </div>
      {/if}

      <div class="flex items-baseline gap-2 truncate">
        {#if timeGranularity === 'year'}
          {#if groupIndex === 0}
            <span class="text-base font-bold text-immich-primary">
              {timelineMonth.yearMonth.year}
            </span>
          {/if}
          <span class="text-xs font-semibold text-gray-500 dark:text-gray-400">
            {timelineMonth.title}
          </span>
        {:else if timeGranularity === 'month'}
          {#if groupIndex === 0}
            <span class="text-sm font-bold text-immich-primary">
              {timelineMonth.title}
            </span>
            <span class="text-xs text-gray-400 dark:text-gray-500">·</span>
          {/if}
          <span class="text-xs font-medium text-immich-fg dark:text-immich-dark-fg">
            {timelineDay.groupTitle}
          </span>
        {:else}
          <span
            class="w-full truncate first-letter:capitalize font-medium text-immich-fg dark:text-immich-dark-fg"
            title={getTimelineDayFullDate(timelineDay)}
          >
            {timelineDay.groupTitle}
          </span>
        {/if}
      </div>
    </div>

    <AssetLayout
      {manager}
      viewerAssets={timelineDay.activeViewerAssets}
      height={timelineDay.height}
      width={timelineDay.width}
      {customThumbnailLayout}
    >
      {#snippet thumbnail({ asset, position })}
        {@render thumbnailWithGroup({ asset, position, timelineDay, groupIndex })}
      {/snippet}
    </AssetLayout>
  </section>
{/each}

<style>
  section {
    contain: layout paint style;
  }
</style>
