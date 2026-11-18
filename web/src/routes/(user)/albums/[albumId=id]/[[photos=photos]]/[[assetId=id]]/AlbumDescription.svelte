<script lang="ts">
  import { shortcut } from '#lib/actions/shortcut.ts';
  import { updateAlbumInfoMutation } from '#lib/queries/album.query.ts';
  import { executeMutation } from '#lib/queries/client.ts';
  import { Textarea } from '@immich/ui';
  import { t } from 'svelte-i18n';
  import { fromAction } from 'svelte/attachments';

  interface Props {
    id: string;
    description: string;
    isEditor: boolean;
  }

  let { id, description, isEditor }: Props = $props();

  const parentTag = $derived(description?.match(/\[PARENT:[^\]]+\]/)?.[0] || '');
  let value = $state(description?.replace(/\[PARENT:[^\]]+\]/g, '').trim() || '');

  $effect(() => {
    value = description?.replace(/\[PARENT:[^\]]+\]/g, '').trim() || '';
  });

  const handleFocusOut = () => {
    const finalDesc = parentTag ? (value ? `${parentTag} ${value}` : parentTag) : value || null;
    return executeMutation(
      () => updateAlbumInfoMutation({ error: { toast: 'errors.unable_to_save_album' } }),
      [{ id, updateAlbumDto: { description: finalDesc } }],
    );
  };
</script>

{#if isEditor}
  <Textarea
    bind:value
    variant="ghost"
    onfocusout={handleFocusOut}
    placeholder={$t('add_a_description')}
    data-testid="autogrow-textarea"
    class="max-h-32"
    {@attach fromAction(shortcut, () => ({
      shortcut: { key: 'Enter', ctrl: true },
      onShortcut: (e) => e.currentTarget.blur(),
    }))}
  />
{:else if description}
  <p class="wrap-break-words w-full text-base whitespace-pre-line text-black dark:text-white">
    {description.replace(/\[PARENT:[^\]]+\]/g, '').trim()}
  </p>
{/if}
