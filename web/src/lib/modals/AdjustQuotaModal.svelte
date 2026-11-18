<script lang="ts">
  import { executeMutation, queryClient } from '#lib/queries/client.ts';
  import { getStorageQuery } from '#lib/queries/server-info.query.ts';
  import { updateUserAdminMutation } from '#lib/queries/user-admin.query.ts';
  import { ByteUnit, convertFromBytes, convertToBytes, getByteUnitString } from '#lib/utils/byte-units.ts';
  import type { UserAdminResponseDto } from '@immich/sdk';
  import { Button, Field, FormModal, NumberInput, Text } from '@immich/ui';
  import { mdiChartPieOutline } from '@mdi/js';
  import { createQuery } from '@tanstack/svelte-query';
  import { locale, t } from 'svelte-i18n';

  type Props = {
    user: UserAdminResponseDto;
    onClose: () => void;
  };

  let { user, onClose }: Props = $props();

  const storageQuery = createQuery(getStorageQuery, () => queryClient);
  const serverInfo = $derived(storageQuery.data);

  const initialGib = typeof user.quotaSizeInBytes === 'number'
    ? convertFromBytes(user.quotaSizeInBytes, ByteUnit.GiB)
    : undefined;

  let quotaSize: number | undefined = $state(initialGib);
  let selectedPreset = $state<string>(initialGib === undefined ? 'unlimited' : `${initialGib}`);

  const presets = [
    { id: 'unlimited', label: 'Unlimited', gib: undefined },
    { id: '15', label: '15 GiB (Free)', gib: 15 },
    { id: '100', label: '100 GiB (Basic)', gib: 100 },
    { id: '200', label: '200 GiB (Standard)', gib: 200 },
    { id: '2048', label: '2 TiB (Premium)', gib: 2048 },
  ];

  const handleSelectPreset = (id: string, gib?: number) => {
    selectedPreset = id;
    quotaSize = gib;
  };

  const handleCustomInput = (val?: number) => {
    quotaSize = val;
    selectedPreset = val === undefined ? 'unlimited' : 'custom';
  };

  const quotaSizeBytes = $derived(
    typeof quotaSize === 'number' && !isNaN(quotaSize) && quotaSize > 0
      ? convertToBytes(quotaSize, ByteUnit.GiB)
      : null,
  );

  const quotaSizeWarning = $derived(
    !!quotaSizeBytes && serverInfo && quotaSizeBytes > serverInfo.diskSizeRaw,
  );

  const onSubmit = async () => {
    await executeMutation(
      updateUserAdminMutation,
      [
        {
          id: user.id,
          userAdminUpdateDto: {
            quotaSizeInBytes: quotaSizeBytes,
          },
        },
      ],
      {
        onSuccess: onClose,
      },
    );
  };
</script>

<FormModal title={$t('adjust_quota')} size="small" icon={mdiChartPieOutline} {onClose} {onSubmit}>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-1 rounded-lg bg-gray-100 p-3 dark:bg-gray-800">
      <div class="flex justify-between text-sm">
        <span class="text-gray-600 dark:text-gray-400">{$t('user')}</span>
        <span class="font-semibold text-black dark:text-white">{user.name} ({user.email})</span>
      </div>
      <div class="flex justify-between text-sm">
        <span class="text-gray-600 dark:text-gray-400">{$t('storage')}</span>
        <span class="font-semibold text-black dark:text-white">
          {getByteUnitString(user.quotaUsageInBytes ?? 0, $locale, 2)}
          {#if user.quotaSizeInBytes !== null && user.quotaSizeInBytes >= 0}
            / {getByteUnitString(user.quotaSizeInBytes, $locale, 2)}
          {:else}
            / {$t('unlimited')}
          {/if}
        </span>
      </div>
    </div>

    <div>
      <span class="mb-2 block text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
        {$t('preset_tiers')}
      </span>
      <div class="grid grid-cols-2 gap-2">
        {#each presets as preset}
          <button
            type="button"
            onclick={() => handleSelectPreset(preset.id, preset.gib)}
            class="flex flex-col rounded-lg border p-2.5 text-start transition-colors cursor-pointer {selectedPreset === preset.id
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600'}"
          >
            <span class="text-xs font-bold">{preset.label}</span>
          </button>
        {/each}
      </div>
    </div>

    <Field label={$t('custom_allocation_gib')}>
      <NumberInput
        value={quotaSize}
        oninput={(e) => handleCustomInput((e.target as HTMLInputElement).value ? Number((e.target as HTMLInputElement).value) : undefined)}
        min="0"
        step="1"
        placeholder={$t('unlimited')}
      />
      {#if quotaSizeWarning}
        <Text size="small" color="danger">{$t('errors.quota_higher_than_disk_size')}</Text>
      {/if}
    </Field>
  </div>
</FormModal>
