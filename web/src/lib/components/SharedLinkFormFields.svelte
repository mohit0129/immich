<script lang="ts">
  import SharedLinkExpiration from '#lib/components/SharedLinkExpiration.svelte';
  import { Button, Field, HelperText, Input, PasswordInput, Switch, Text } from '@immich/ui';
  import { mdiClose, mdiLockOutline } from '@mdi/js';
  import { t } from 'svelte-i18n';

  type Props = {
    slug: string;
    password: string;
    description: string;
    allowDownload: boolean;
    allowUpload: boolean;
    showMetadata: boolean;
    expiresAt: string | null;
    requiresApproval?: boolean;
  };

  let {
    slug = $bindable(),
    password = $bindable(),
    description = $bindable(),
    allowDownload = $bindable(),
    allowUpload = $bindable(),
    showMetadata = $bindable(),
    expiresAt = $bindable(),
    requiresApproval = $bindable(false),
  }: Props = $props();

  let neverExpire = $state(!expiresAt);
  let showPassword = $state(!!password);

  $effect(() => {
    if (neverExpire) {
      expiresAt = null;
    }
  });

  $effect(() => {
    if (!showPassword) {
      password = '';
    }
  });

  $effect(() => {
    if (!showMetadata && allowDownload) {
      allowDownload = false;
    }
  });
</script>

<div class="mt-4 flex flex-col gap-4">
  <div>
    <Field label={$t('shared_link_custom_url_title')} description={$t('shared_link_custom_url_description')}>
      <Input bind:value={slug} autocomplete="off" />
      {#if slug.includes('/')}
        <HelperText class="text-warning">{$t('shared_link_custom_url_warning')}</HelperText>
      {/if}
    </Field>
    {#if slug}
      <Text size="tiny" color="muted" class="pt-2 break-all">/s/{encodeURIComponent(slug)}</Text>
    {/if}
  </div>

  {#if !showPassword}
    <div class="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-800">
      <div class="flex flex-col">
        <span class="text-sm font-medium dark:text-white">{$t('password')}</span>
        <span class="text-xs text-gray-500">Protect this shared link with a password</span>
      </div>
      <Button
        size="tiny"
        variant="outline"
        leadingIcon={mdiLockOutline}
        onclick={() => (showPassword = true)}
      >
        Set password
      </Button>
    </div>
  {:else}
    <div class="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
      <div class="mb-2 flex items-center justify-between">
        <span class="text-sm font-medium dark:text-white">{$t('password')}</span>
        <Button
          size="tiny"
          variant="ghost"
          leadingIcon={mdiClose}
          onclick={() => {
            showPassword = false;
            password = '';
          }}
        >
          Remove
        </Button>
      </div>
      <Field label="" description={$t('shared_link_password_description')}>
        <PasswordInput bind:value={password} autocomplete="new-password" placeholder="Enter password" />
      </Field>
    </div>
  {/if}

  <Field label={$t('description')}>
    <Input bind:value={description} autocomplete="off" />
  </Field>

  <div class="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 dark:border-gray-800">
    <div class="flex items-center justify-between">
      <div class="flex flex-col">
        <span class="text-sm font-medium dark:text-white">Never expire</span>
        <span class="text-xs text-gray-500">Keep this shared link accessible indefinitely</span>
      </div>
      <Switch bind:checked={neverExpire} />
    </div>

    {#if !neverExpire}
      <div class="mt-2 border-t pt-2 dark:border-gray-800">
        <SharedLinkExpiration bind:expiresAt />
      </div>
    {/if}
  </div>

  <div class="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-800">
    <div class="flex flex-col">
      <span class="text-sm font-medium dark:text-white">Require approval to view</span>
      <span class="text-xs text-gray-500">Visitors must enter their name and wait for your approval before viewing</span>
    </div>
    <Switch bind:checked={requiresApproval} />
  </div>

  <Field label={$t('show_metadata')}>
    <Switch bind:checked={showMetadata} />
  </Field>

  <Field label={$t('allow_public_user_to_download')} disabled={!showMetadata}>
    <Switch bind:checked={allowDownload} />
  </Field>

  <Field label={$t('allow_public_user_to_upload')}>
    <Switch bind:checked={allowUpload} />
  </Field>
</div>
