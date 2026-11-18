<script lang="ts">
  import { getAssetMediaUrl } from '#lib/utils.ts';
  import type { MapMarkerResponseDto } from '@immich/sdk';
  import { Icon } from '@immich/ui';
  import { mdiMapMarker } from '@mdi/js';
  import type { Feature } from 'geojson';
  import type { Snippet } from 'svelte';
  import { t } from 'svelte-i18n';
  import { Popup } from 'svelte-maplibre';

  interface Props {
    feature: Feature;
    useLocationPin?: boolean;
    popup?: Snippet<[{ marker: MapMarkerResponseDto }]>;
    asMarker?: (feature: Feature) => MapMarkerResponseDto;
  }

  let { feature, useLocationPin = false, popup, asMarker }: Props = $props();

  const assetId = $derived(feature.properties?.id as string | undefined);
  const city = $derived(feature.properties?.city as string | undefined);
  const country = $derived(feature.properties?.country as string | undefined);

  const altText = $derived(
    city && country
      ? $t('map_marker_for_image', { values: { city, country } })
      : $t('map_marker_with_image'),
  );
</script>

<div class="relative flex flex-col items-center pointer-events-auto select-none group cursor-pointer">
  <div class="relative flex flex-col items-center transition-all duration-300 ease-out group-hover:scale-115 group-hover:-translate-y-1.5">
    {#if useLocationPin}
      <Icon icon={mdiMapMarker} size="44px" class="translate-y-[calc(5px-50%)] text-primary drop-shadow-md" />
    {:else if assetId}
      <div class="pointer-events-none absolute top-7 sm:top-8 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center z-0">
        <span class="radar-pulse-ring radar-pulse-1"></span>
        <span class="radar-pulse-ring radar-pulse-2"></span>
        <span class="radar-pulse-ring radar-pulse-3"></span>
      </div>

      <div class="relative size-14 sm:size-16 rounded-2xl overflow-hidden border-2 border-white dark:border-gray-800 shadow-xl bg-gray-200 dark:bg-gray-700 ring-1 ring-black/15 z-10">
        <img
          src={getAssetMediaUrl({ id: assetId })}
          alt={altText}
          loading="lazy"
          class="size-full object-cover"
        />
        <div class="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent pointer-events-none"></div>
      </div>
      <div class="w-0 h-0 border-x-[5px] border-x-transparent border-t-[6px] border-t-white dark:border-t-gray-800 drop-shadow-sm -mt-0.5 z-20"></div>
    {/if}
  </div>

  {#if popup && asMarker}
    <Popup offset={[0, -30]} openOn="click" closeOnClickOutside>
      {@render popup({ marker: asMarker(feature) })}
    </Popup>
  {/if}
</div>
