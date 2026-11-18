<script lang="ts">
  import AuthPageLayout from '#lib/components/layouts/AuthPageLayout.svelte';
  import PinCodeCreateForm from '#lib/components/user-settings-page/PinCodeCreateForm.svelte';
  import { Route } from '#lib/route.ts';
  import { handleError } from '#lib/utils/handle-error.ts';
  import { unlockAuthSession } from '@immich/sdk';
  import { Button, Icon, PinInput } from '@immich/ui';
  import { mdiLockOpenVariantOutline, mdiLockOutline, mdiLockSmart } from '@mdi/js';
  import { t } from 'svelte-i18n';
  import { fade } from 'svelte/transition';
  import { goto } from '$app/navigation';
  import type { PageData } from './$types';

  interface Props {
    data: PageData;
  }

  let { data }: Props = $props();

  let isVerified = $state(false);
  let isBadPinCode = $state(false);
  let hasPinCode = $derived(data.hasPinCode);
  let pinCode = $state('');
  let pinLength = $state<4 | 6>(6);

  const handleUnlockSession = async (code: string) => {
    try {
      await unlockAuthSession({ sessionUnlockDto: { pinCode: code } });

      isVerified = true;

      await new Promise((resolve) => setTimeout(resolve, 1000));

      await goto(data.continueUrl);
    } catch (error) {
      handleError(error, $t('wrong_pin_code'));
      isBadPinCode = true;
    }
  };
</script>

<AuthPageLayout withHeader={false}>
  <div class="flex items-center justify-center">
    <div class="flex w-96 flex-col items-center justify-center gap-6">
      {#if hasPinCode}
        {#if isVerified}
          <div in:fade={{ duration: 200 }}>
            <Icon icon={mdiLockOpenVariantOutline} size="64" class="text-success/90" />
          </div>
        {:else}
          <div class:text-danger={isBadPinCode} class:text-primary={!isBadPinCode}>
            <Icon icon={mdiLockOutline} size="64" />
          </div>
        {/if}

        <p class="text-center text-sm" style="text-wrap: pretty;">{$t('enter_your_pin_code_subtitle')}</p>

        <div class="flex items-center gap-2">
          <div class="flex rounded-full bg-gray-100 p-1 dark:bg-gray-800">
            <button
              type="button"
              class="rounded-full px-3 py-0.5 text-xs font-medium transition-colors {pinLength === 4 ? 'bg-primary text-white shadow' : 'text-gray-600 dark:text-gray-300 hover:text-primary'}"
              onclick={() => { pinLength = 4; pinCode = ''; }}
            >
              4 digits
            </button>
            <button
              type="button"
              class="rounded-full px-3 py-0.5 text-xs font-medium transition-colors {pinLength === 6 ? 'bg-primary text-white shadow' : 'text-gray-600 dark:text-gray-300 hover:text-primary'}"
              onclick={() => { pinLength = 6; pinCode = ''; }}
            >
              6 digits
            </button>
          </div>
        </div>

        <PinInput length={pinLength} password autofocus bind:value={pinCode} onComplete={handleUnlockSession} />
      {:else}
        <div class="text-primary">
          <Icon icon={mdiLockSmart} size="64" />
        </div>
        <p class="mb-4 text-center text-sm" style="text-wrap: pretty;">
          {$t('new_pin_code_subtitle')}
        </p>
        <PinCodeCreateForm showLabel={false} onCreated={() => (hasPinCode = true)} />
      {/if}

      <div class={hasPinCode ? '' : 'flex w-full items-start'}>
        <Button type="button" color="secondary" onclick={() => goto(Route.photos())}>{$t('cancel')}</Button>
      </div>
    </div>
  </div>
</AuthPageLayout>
