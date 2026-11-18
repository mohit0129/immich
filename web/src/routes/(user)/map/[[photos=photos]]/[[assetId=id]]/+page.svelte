<script lang="ts">
  import UserPageLayout from '#lib/components/layouts/UserPageLayout.svelte';
  import type { SelectionBBox } from '#lib/components/shared-components/map/types.ts';
  import { timeToLoadTheMap } from '#lib/constants.ts';
  import Portal from '#lib/elements/Portal.svelte';
  import { assetViewerManager } from '#lib/managers/asset-viewer-manager.svelte.ts';
  import { createPreloadedQuery } from '#lib/queries/client.ts';
  import { getUserConfigQuery } from '#lib/queries/config-user.query.ts';
  import { getAssetsByCityQuery } from '#lib/queries/search.query.ts';
  import { Route } from '#lib/route.ts';
  import { mapSettings } from '#lib/stores/preferences.store.ts';
  import { getAssetMediaUrl, handlePromiseError } from '#lib/utils.ts';
  import { delay } from '#lib/utils/asset-utils.ts';
  import { navigate } from '#lib/utils/navigation.ts';
  import { Icon, LoadingSpinner } from '@immich/ui';
  import { mdiCards, mdiChevronDown, mdiChevronUp, mdiMapMarker } from '@mdi/js';
  import type { Map as MapLibreMap } from 'maplibre-gl';
  import { onDestroy } from 'svelte';
  import { t } from 'svelte-i18n';
  import { goto } from '$app/navigation';
  import type { PageData } from './$types';
  import MapTimelinePanel from './MapTimelinePanel.svelte';

  const userConfigQuery = createPreloadedQuery(getUserConfigQuery);
  const config = $derived(userConfigQuery.data);

  const placesQuery = createPreloadedQuery(getAssetsByCityQuery);
  const placesItems = $derived(placesQuery.data ?? []);

  const citiesWithCoords = $derived(
    placesItems.filter(
      (item) => item.exifInfo?.city && item.exifInfo?.latitude !== null && item.exifInfo?.longitude !== null,
    ),
  );

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();
  let mapInstance = $state<MapLibreMap>();
  let selectedClusterIds = $state.raw(new Set<string>());
  let selectedClusterBBox = $state.raw<SelectionBBox>();
  let isTimelinePanelVisible = $state(false);
  let showPlacesShelf = $state(false);

  function closeTimelinePanel() {
    isTimelinePanelVisible = false;
    selectedClusterBBox = undefined;
    selectedClusterIds = new Set();
  }

  onDestroy(() => {
    assetViewerManager.showAssetViewer(false);
  });

  $effect(() => {
    if (config?.map?.enabled === false) {
      handlePromiseError(goto(Route.photos()));
    }
  });

  async function onViewAssets(assetIds: string[]) {
    await assetViewerManager.setAssetId(assetIds[0]);
    closeTimelinePanel();
  }

  function onClusterSelect(assetIds: string[], bbox: SelectionBBox) {
    selectedClusterIds = new Set(assetIds);
    selectedClusterBBox = bbox;
    isTimelinePanelVisible = true;
    assetViewerManager.showAssetViewer(false);
    handlePromiseError(navigate({ targetRoute: 'current', assetId: null }));
  }

  function flyToCity(latitude: number, longitude: number) {
    if (mapInstance) {
      mapInstance.flyTo({
        center: [longitude, latitude],
        zoom: 12,
        essential: true,
      });
    }
  }
</script>

<UserPageLayout title={data.meta.title}>
  {#snippet buttons()}
    <div class="flex items-center gap-2">
      <a
        href={Route.places()}
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition text-immich-fg dark:text-immich-dark-fg"
      >
        <Icon icon={mdiMapMarker} size="16px" class="text-immich-primary" />
        <span>{$t('places')}</span>
      </a>
      <a
        href={Route.memories()}
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 transition text-immich-fg dark:text-immich-dark-fg"
      >
        <Icon icon={mdiCards} size="16px" class="text-immich-primary" />
        <span>{$t('memories')}</span>
      </a>
    </div>
  {/snippet}

  <div class="isolate flex size-full flex-col sm:flex-row relative">
    <div
      class={[
        'min-h-0 relative',
        isTimelinePanelVisible ? 'h-1/2 w-full pb-2 sm:h-full sm:w-2/3 sm:pe-2 sm:pb-0' : 'size-full',
      ]}
    >
      {#await import('#lib/components/shared-components/map/Map.svelte')}
        {#await delay(timeToLoadTheMap) then}
          <div class="flex size-full items-center justify-center">
            <LoadingSpinner />
          </div>
        {/await}
      {:then { default: Map }}
        <Map
          bind:map={mapInstance}
          hash
          onSelect={onViewAssets}
          {onClusterSelect}
          onViewportClose={closeTimelinePanel}
          viewportGridActive={isTimelinePanelVisible}
          autoOpenPanel={$mapSettings.showAssetPanel}
        />
      {/await}

      {#if citiesWithCoords.length > 0 && !isTimelinePanelVisible}
        <div class="absolute bottom-6 left-6 z-10 flex flex-col items-start gap-2 max-w-[calc(100%-3rem)]">
          <button
            type="button"
            onclick={() => (showPlacesShelf = !showPlacesShelf)}
            class="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/90 dark:bg-gray-900/90 backdrop-blur-md shadow-lg border border-black/5 dark:border-white/10 text-xs font-semibold text-immich-primary transition hover:scale-105 active:scale-95 cursor-pointer"
          >
            <Icon icon={mdiMapMarker} size="16px" />
            <span>{$t('places')} ({citiesWithCoords.length})</span>
            <Icon icon={showPlacesShelf ? mdiChevronDown : mdiChevronUp} size="16px" />
          </button>

          {#if showPlacesShelf}
            <div class="flex items-center gap-2 p-2 rounded-2xl bg-white/90 dark:bg-gray-900/90 backdrop-blur-md shadow-2xl border border-black/5 dark:border-white/10 overflow-x-auto max-w-full">
              {#each citiesWithCoords.slice(0, 12) as cityAsset}
                <button
                  type="button"
                  onclick={() => flyToCity(cityAsset.exifInfo.latitude!, cityAsset.exifInfo.longitude!)}
                  class="group flex flex-col items-center gap-1 p-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition shrink-0 cursor-pointer"
                >
                  <div class="relative size-12 rounded-xl overflow-hidden shadow-sm border border-black/10 dark:border-white/10 group-hover:scale-105 transition">
                    <img
                      src={getAssetMediaUrl({ id: cityAsset.id })}
                      alt={cityAsset.exifInfo.city}
                      class="size-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <span class="text-[11px] font-medium max-w-[64px] truncate text-center text-immich-fg dark:text-immich-dark-fg">
                    {cityAsset.exifInfo.city}
                  </span>
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </div>

    {#if isTimelinePanelVisible && selectedClusterBBox}
      <div class="h-1/2 min-h-0 w-full pt-2 sm:h-full sm:w-1/3 sm:ps-2 sm:pt-0">
        <MapTimelinePanel
          bbox={selectedClusterBBox}
          {selectedClusterIds}
          assetCount={selectedClusterIds.size}
          onClose={closeTimelinePanel}
        />
      </div>
    {/if}
  </div>
</UserPageLayout>

<Portal target="body">
  {#if assetViewerManager.isViewing && !isTimelinePanelVisible}
    {#await import('#lib/components/asset-viewer/AssetViewer.svelte') then { default: AssetViewer }}
      <AssetViewer
        cursor={{ current: assetViewerManager.asset! }}
        showNavigation={false}
        onClose={() => {
          assetViewerManager.showAssetViewer(false);
          handlePromiseError(navigate({ targetRoute: 'current', assetId: null }));
        }}
        isShared={false}
      />
    {/await}
  {/if}
</Portal>
