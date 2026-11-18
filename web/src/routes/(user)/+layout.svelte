<script lang="ts">
  import { assetViewerManager } from '#lib/managers/asset-viewer-manager.svelte.ts';
  import { Button, Icon } from '@immich/ui';
  import { mdiAlertOutline } from '@mdi/js';
  import { onMount, type Snippet } from 'svelte';
  import { page } from '$app/state';
  import UploadCover from './DragAndDropUploadOverlay.svelte';

  interface Props {
    children?: Snippet;
  }

  let { children }: Props = $props();

  let warningNotification = $state<any>(null);

  onMount(async () => {
    try {
      const res = await fetch('/api/notifications?unread=true');
      if (res.ok) {
        const notifications = await res.json();
        if (Array.isArray(notifications)) {
          const warn = notifications.find(
            (n) =>
              (n.level === 'warning' || n.level === 'warn') &&
              !sessionStorage.getItem('seen_warning_' + n.id),
          );
          if (warn) {
            warningNotification = warn;
          }
        }
      }
    } catch {
      // Ignore network errors
    }
  });

  const dismissWarning = () => {
    if (warningNotification?.id) {
      sessionStorage.setItem('seen_warning_' + warningNotification.id, 'true');
    }
    warningNotification = null;
  };

  // $page.data.asset is loaded by route specific +page.ts loaders if that
  // route contains the assetId path.
  $effect.pre(() => {
    if (page.data.asset) {
      assetViewerManager.setAsset(page.data.asset);
    } else {
      assetViewerManager.showAssetViewer(false);
    }
    const asset = page.url.searchParams.get('at');
    assetViewerManager.gridScrollTarget = { at: asset };
  });
</script>

<div class:display-none={assetViewerManager.isViewing}>
  {@render children?.()}
</div>
<UploadCover />

{#if warningNotification}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
    <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900 border border-amber-500/40">
      <div class="flex items-center gap-3 text-amber-500 mb-3">
        <Icon icon={mdiAlertOutline} size="36" />
        <h2 class="text-xl font-bold dark:text-white">{warningNotification.title}</h2>
      </div>
      <p class="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-line mb-6">
        {warningNotification.description}
      </p>
      <div class="flex justify-end gap-2">
        <Button color="primary" onclick={dismissWarning}>
          Acknowledge
        </Button>
      </div>
    </div>
  </div>
{/if}

<style>
  :root {
    overscroll-behavior: none;
  }
  .display-none {
    display: none;
  }
</style>
