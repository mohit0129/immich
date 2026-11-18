<script lang="ts">
  import PinCodeResetModal from '#lib/modals/PinCodeResetModal.svelte';
  import { handleError } from '#lib/utils/handle-error.ts';
  import { changePinCode } from '@immich/sdk';
  import { Button, Field, Heading, PinInput, Text, modalManager, toastManager } from '@immich/ui';
  import { t } from 'svelte-i18n';

  let currentPinCode = $state('');
  let newPinCode = $state('');
  let confirmPinCode = $state('');
  let currentPinLength = $state<4 | 6>(6);
  let newPinLength = $state<4 | 6>(6);
  let isLoading = $state(false);
  let canSubmit = $derived(
    currentPinCode.length === currentPinLength &&
      confirmPinCode.length === newPinLength &&
      newPinCode === confirmPinCode,
  );

  const handleSubmit = async (event: Event) => {
    event.preventDefault();
    await handleChangePinCode();
  };

  const handleChangePinCode = async () => {
    isLoading = true;
    try {
      await changePinCode({ pinCodeChangeDto: { pinCode: currentPinCode, newPinCode } });
      resetForm();
      toastManager.primary($t('pin_code_changed_successfully'));
    } catch (error) {
      handleError(error, $t('unable_to_change_pin_code'));
    } finally {
      isLoading = false;
    }
  };

  const resetForm = () => {
    currentPinCode = '';
    newPinCode = '';
    confirmPinCode = '';
  };
</script>

<form autocomplete="off" onsubmit={handleSubmit}>
  <div class="flex flex-col place-content-center place-items-center gap-6">
    <Heading>{$t('change_pin_code')}</Heading>
    <div class="flex items-center gap-2">
      <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Current PIN:</span>
      <div class="flex rounded-full bg-gray-100 p-1 dark:bg-gray-800">
        <button
          type="button"
          class="rounded-full px-3 py-0.5 text-xs font-medium transition-colors {currentPinLength === 4 ? 'bg-primary text-white shadow' : 'text-gray-600 dark:text-gray-300 hover:text-primary'}"
          onclick={() => { currentPinLength = 4; currentPinCode = ''; }}
        >
          4 digits
        </button>
        <button
          type="button"
          class="rounded-full px-3 py-0.5 text-xs font-medium transition-colors {currentPinLength === 6 ? 'bg-primary text-white shadow' : 'text-gray-600 dark:text-gray-300 hover:text-primary'}"
          onclick={() => { currentPinLength = 6; currentPinCode = ''; }}
        >
          6 digits
        </button>
      </div>
    </div>
    <Field label={$t('current_pin_code')}>
      <PinInput length={currentPinLength} bind:value={currentPinCode} />
    </Field>
    <div class="flex items-center gap-2">
      <span class="text-sm font-medium text-gray-700 dark:text-gray-300">New PIN:</span>
      <div class="flex rounded-full bg-gray-100 p-1 dark:bg-gray-800">
        <button
          type="button"
          class="rounded-full px-3 py-0.5 text-xs font-medium transition-colors {newPinLength === 4 ? 'bg-primary text-white shadow' : 'text-gray-600 dark:text-gray-300 hover:text-primary'}"
          onclick={() => { newPinLength = 4; newPinCode = ''; confirmPinCode = ''; }}
        >
          4 digits
        </button>
        <button
          type="button"
          class="rounded-full px-3 py-0.5 text-xs font-medium transition-colors {newPinLength === 6 ? 'bg-primary text-white shadow' : 'text-gray-600 dark:text-gray-300 hover:text-primary'}"
          onclick={() => { newPinLength = 6; newPinCode = ''; confirmPinCode = ''; }}
        >
          6 digits
        </button>
      </div>
    </div>
    <Field label={$t('new_pin_code')}>
      <PinInput length={newPinLength} bind:value={newPinCode} />
    </Field>
    <Field label={$t('confirm_new_pin_code')}>
      <PinInput length={newPinLength} bind:value={confirmPinCode} />
    </Field>
    <button type="button" onclick={() => modalManager.show(PinCodeResetModal, {})}>
      <Text color="muted" class="underline" size="small">{$t('forgot_pin_code_question')}</Text>
    </button>
  </div>

  <div class="mt-4 flex justify-end gap-2">
    <Button shape="round" color="secondary" type="button" size="small" onclick={resetForm}>
      {$t('clear')}
    </Button>
    <Button shape="round" type="submit" size="small" loading={isLoading} disabled={!canSubmit}>
      {$t('save')}
    </Button>
  </div>
</form>
