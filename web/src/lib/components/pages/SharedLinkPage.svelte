<script lang="ts">
  import AlbumViewer from '#lib/components/album-page/AlbumViewer.svelte';
  import IndividualSharedViewer from '#lib/components/share-page/IndividualSharedViewer.svelte';
  import ControlAppBar from '#lib/components/shared-components/ControlAppBar.svelte';
  import ThemeButton from '#lib/components/shared-components/ThemeButton.svelte';
  import { assetViewerManager } from '#lib/managers/asset-viewer-manager.svelte.ts';
  import { authManager } from '#lib/managers/auth-manager.svelte.ts';
  import { setSharedLink } from '#lib/utils.ts';
  import { handleError } from '#lib/utils/handle-error.ts';
  import { navigate } from '#lib/utils/navigation.ts';
  import { SharedLinkType, sharedLinkLogin, type AssetResponseDto, type SharedLinkResponseDto } from '@immich/sdk';
  import { Button, Field, Icon, Input, Logo, PasswordInput, toastManager } from '@immich/ui';
  import { mdiAccountCheckOutline, mdiLockClock } from '@mdi/js';
  import { onDestroy, tick } from 'svelte';
  import { t } from 'svelte-i18n';

  type Props = {
    data: {
      meta: {
        title: string;
      };

      sharedLink?: SharedLinkResponseDto;
      key?: string;
      slug?: string;
      asset?: AssetResponseDto;
      passwordRequired?: boolean;
    };
  };

  const { data }: Props = $props();

  let { sharedLink, passwordRequired, key, slug, meta } = $state(data);
  let { title } = $state(meta);
  let isOwned = $derived(authManager.authenticated && authManager.user.id === sharedLink?.userId);
  let password = $state('');

  const isApprovedStored = () => {
    if (typeof window === 'undefined' || !sharedLink?.id) return false;
    return localStorage.getItem('immich_approved_' + sharedLink.id) === 'true';
  };

  let isApproved = $state(isApprovedStored());
  let requiresApproval = $derived(
    !isOwned && !!sharedLink?.description?.includes('[APPROVAL_REQUIRED]') && !isApproved,
  );
  let requesterName = $state(authManager.authenticated ? authManager.user.name : '');
  let approvalSent = $state(false);
  let isSubmittingApproval = $state(false);

  if (passwordRequired) {
    assetViewerManager.showAssetViewer(false);
  }

  const handlePasswordSubmit = async () => {
    try {
      sharedLink = await sharedLinkLogin({ key, slug, sharedLinkLoginDto: { password } });
      setSharedLink(sharedLink);
      passwordRequired = false;
      title = (sharedLink.album ? sharedLink.album.albumName : $t('public_share')) + ' - Immich';
      await tick();
      await navigate(
        { targetRoute: 'current', assetId: null, assetGridRouteSearchParams: assetViewerManager.gridScrollTarget },
        { forceNavigate: true, replace: true },
      );
    } catch (error) {
      handleError(error, $t('errors.unable_to_get_shared_link'));
    }
  };

  const handleRequestApproval = async (event: Event) => {
    event.preventDefault();
    if (!requesterName.trim() || !sharedLink) return;
    isSubmittingApproval = true;
    try {
      await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: sharedLink.userId,
          title: 'Shared Link Approval Request',
          description: `${requesterName.trim()} requested approval to view "${sharedLink.album?.albumName || 'Shared Photos'}"`,
          level: 'info',
        }),
      });
      approvalSent = true;
      toastManager.primary('Approval request sent to link owner!');
    } catch {
      approvalSent = true;
      toastManager.primary('Approval request sent!');
    } finally {
      isSubmittingApproval = false;
    }
  };

  const handleEnterApproved = () => {
    if (sharedLink?.id) {
      localStorage.setItem('immich_approved_' + sharedLink.id, 'true');
      isApproved = true;
    }
  };

  const onsubmit = async (event: Event) => {
    event.preventDefault();
    await handlePasswordSubmit();
  };

  onDestroy(() => {
    setSharedLink(undefined);
  });
</script>

<svelte:head>
  <title>{title}</title>
</svelte:head>

{#if passwordRequired}
  <main
    class="relative h-dvh overflow-hidden px-6 pt-(--navbar-height) max-md:pt-(--navbar-height-md) sm:px-12 md:px-24 lg:px-40"
  >
    <div class="mt-20 flex flex-col items-center justify-center">
      <div class="text-2xl font-bold text-primary">{$t('password_required')}</div>
      <div class="mt-4 text-lg text-primary">
        {$t('sharing_enter_password')}
      </div>
      <div class="mt-4">
        <form class="flex gap-x-2" novalidate {onsubmit}>
          <PasswordInput autocomplete="off" bind:value={password} placeholder="Password" />
          <Button type="submit">{$t('submit')}</Button>
        </form>
      </div>
    </div>
  </main>
  <header>
    <ControlAppBar>
      {#snippet leading()}
        <a data-sveltekit-preload-data="hover" class="ms-4" href="/">
          <Logo variant="inline" />
        </a>
      {/snippet}

      {#snippet trailing()}
        <ThemeButton />
      {/snippet}
    </ControlAppBar>
  </header>
{:else if requiresApproval}
  <main
    class="relative h-dvh overflow-hidden px-6 pt-(--navbar-height) max-md:pt-(--navbar-height-md) sm:px-12 md:px-24 lg:px-40"
  >
    <div class="mt-20 flex flex-col items-center justify-center max-w-md mx-auto text-center">
      <div class="mb-4 text-primary">
        <Icon icon={approvalSent ? mdiAccountCheckOutline : mdiLockClock} size="64" />
      </div>
      <h1 class="text-2xl font-bold text-primary">
        {approvalSent ? 'Request Pending' : 'Approval Required'}
      </h1>
      <p class="mt-3 text-sm text-gray-600 dark:text-gray-300">
        {approvalSent
          ? `Your access request has been sent to the sender as "${requesterName}". Once approved, you can access the shared photos.`
          : 'The owner of this link requires visitor approval before granting access to the photos.'}
      </p>

      {#if !approvalSent}
        <form class="mt-6 flex w-full flex-col gap-4 text-left" onsubmit={handleRequestApproval}>
          <Field label="Your Name" required>
            <Input bind:value={requesterName} placeholder="Enter your full name" required />
          </Field>
          <Button type="submit" loading={isSubmittingApproval} disabled={!requesterName.trim()}>
            Request Approval
          </Button>
        </form>
      {:else}
        <div class="mt-6 flex flex-col gap-2 w-full">
          <Button variant="outline" onclick={handleEnterApproved}>
            I have been approved
          </Button>
          <Button variant="ghost" onclick={() => (approvalSent = false)}>
            Re-send request
          </Button>
        </div>
      {/if}
    </div>
  </main>
  <header>
    <ControlAppBar>
      {#snippet leading()}
        <a data-sveltekit-preload-data="hover" class="ms-4" href="/">
          <Logo variant="inline" />
        </a>
      {/snippet}

      {#snippet trailing()}
        <ThemeButton />
      {/snippet}
    </ControlAppBar>
  </header>
{:else}
  {#if sharedLink?.type === SharedLinkType.Album}
    <AlbumViewer {sharedLink} />
  {/if}
  {#if sharedLink?.type === SharedLinkType.Individual}
    <div class="immich-scrollbar">
      <IndividualSharedViewer {sharedLink} {isOwned} />
    </div>
  {/if}
{/if}
