<script lang="ts">
  import { getAssetMediaUrl } from '#lib/utils.ts';
  import type { Feature } from 'geojson';
  import type { GeoJSONSource, Map } from 'maplibre-gl';
  import { t } from 'svelte-i18n';

  interface Props {
    feature: Feature;
    map: Map | null;
  }

  let { feature, map }: Props = $props();

  const clusterId = $derived(feature.properties?.cluster_id as number | undefined);
  const pointCount = $derived((feature.properties?.point_count as number) || 0);

  let assetId = $state<string | null>(null);

  $effect(() => {
    if (clusterId !== undefined && map) {
      const source = map.getSource('geojson') as GeoJSONSource | undefined;
      if (source && typeof source.getClusterLeaves === 'function') {
        source
          .getClusterLeaves(clusterId, 1, 0)
          .then((leaves) => {
            if (leaves && leaves.length > 0 && leaves[0].properties?.id) {
              assetId = leaves[0].properties.id as string;
            }
          })
          .catch(() => {});
      }
    }
  });

  const formattedCount = $derived(
    pointCount > 999 ? `${Math.floor(pointCount / 1000)}k+` : pointCount.toLocaleString(),
  );
</script>

<div class="relative flex flex-col items-center pointer-events-auto select-none group cursor-pointer">
  <div class="relative flex flex-col items-center transition-all duration-300 ease-out group-hover:scale-115 group-hover:-translate-y-1.5">
    <div class="pointer-events-none absolute top-7 sm:top-8 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center z-0">
      <span class="radar-pulse-ring radar-pulse-1"></span>
      <span class="radar-pulse-ring radar-pulse-2"></span>
      <span class="radar-pulse-ring radar-pulse-3"></span>
    </div>

    <div class="absolute -top-1 -right-1 size-14 sm:size-16 rounded-2xl bg-white/70 dark:bg-gray-800/70 border border-white/80 dark:border-gray-700/80 shadow-md rotate-3 pointer-events-none z-5"></div>

    <div class="relative size-14 sm:size-16 rounded-2xl overflow-hidden border-2 border-white dark:border-gray-800 shadow-xl bg-immich-primary ring-1 ring-black/15 z-10 flex items-center justify-center">
      {#if assetId}
        <img
          src={getAssetMediaUrl({ id: assetId })}
          alt={$t('cluster_with_photos', { values: { count: pointCount } })}
          loading="lazy"
          class="size-full object-cover"
        />
        <div class="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none"></div>
      {:else}
        <div class="flex size-full items-center justify-center bg-immich-primary text-white font-mono font-bold text-sm">
          {formattedCount}
        </div>
      {/if}

      <span class="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 min-w-[22px] h-[22px] rounded-full bg-immich-primary text-white text-[11px] font-bold font-mono shadow-md flex items-center justify-center border-2 border-white dark:border-gray-800 z-20">
        +{formattedCount}
      </span>
    </div>

    <div class="w-0 h-0 border-x-[5px] border-x-transparent border-t-[6px] border-t-white dark:border-t-gray-800 drop-shadow-sm -mt-0.5 z-20"></div>
  </div>
</div>
