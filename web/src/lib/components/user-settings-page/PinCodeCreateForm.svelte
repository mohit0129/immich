<script lang="ts">
  import { handleError } from '#lib/utils/handle-error.ts';
  import { setupPinCode } from '@immich/sdk';
  import { Button, Field, Heading, PinInput, toastManager } from '@immich/ui';
  import { t } from 'svelte-i18n';

  interface Props {
    onCreated?: (pinCode: string) => void;
    showLabel?: boolean;
  }

  let { onCreated, showLabel = true }: Props = $props();

  let newPinCode = $state('');
  let confirmPinCode = $state('');
  let pinLength = $state<4 | 6>(6);
  let isLoading = $state(false);
  let canSubmit = $derived(confirmPinCode.length === pinLength && newPinCode === confirmPinCode);

  const handleSubmit = async (event: Event) => {
    event.preventDefault();
    await createPinCode();
  };

  const createPinCode = async () => {
    isLoading = true;
    try {
      await setupPinCode({ pinCodeSetupDto: { pinCode: newPinCode } });
      toastManager.primary($t('pin_code_setup_successfully'));
      onCreated?.(newPinCode);
      resetForm();
    } catch (error) {
      handleError(error, $t('unable_to_setup_pin_code'));
    } finally {
      isLoading = false;
    }
  };

  const resetForm = () => {
    newPinCode = '';
    confirmPinCode = '';
  };
</script>

<form autocomplete="off" onsubmit={handleSubmit}>
  <div class="flex flex-col place-content-center place-items-center gap-6">
    {#if showLabel}
      <Heading>{$t('setup_pin_code')}</Heading>
    {/if}
    <div class="flex items-center gap-2">
      <span class="text-sm font-medium text-gray-700 dark:text-gray-300">PIN length:</span>
      <div class="flex rounded-full bg-gray-100 p-1 dark:bg-gray-800">
        <button
          type="button"
          class="rounded-full px-3 py-0.5 text-xs font-medium transition-colors {pinLength === 4 ? 'bg-primary text-white shadow' : 'text-gray-600 dark:text-gray-300 hover:text-primary'}"
          onclick={() => { pinLength = 4; resetForm(); }}
        >
          4 digits
        </button>
        <button
          type="button"
          class="rounded-full px-3 py-0.5 text-xs font-medium transition-colors {pinLength === 6 ? 'bg-primary text-white shadow' : 'text-gray-600 dark:text-gray-300 hover:text-primary'}"
          onclick={() => { pinLength = 6; resetForm(); }}
        >
          6 digits
        </button>
      </div>
    </div>
    <Field label={$t('new_pin_code')}>
      <PinInput length={pinLength} bind:value={newPinCode} />
    </Field>
    <Field label={$t('confirm_new_pin_code')}>
      <PinInput length={pinLength} bind:value={confirmPinCode} />
    </Field>
  </div>

  <div class="mt-4 flex justify-end gap-2">
    <Button shape="round" color="secondary" type="button" size="small" onclick={resetForm}>
      {$t('clear')}
    </Button>
    <Button shape="round" type="submit" size="small" loading={isLoading} disabled={!canSubmit}>
      {$t('create')}
    </Button>
  </div>
</form>
