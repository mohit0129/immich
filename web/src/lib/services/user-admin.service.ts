import { authManager } from '#lib/managers/auth-manager.svelte.ts';
import AdjustQuotaModal from '#lib/modals/AdjustQuotaModal.svelte';
import PasswordResetSuccessModal from '#lib/modals/PasswordResetSuccessModal.svelte';
import UserDeleteConfirmModal from '#lib/modals/UserDeleteConfirmModal.svelte';
import UserRestoreConfirmModal from '#lib/modals/UserRestoreConfirmModal.svelte';
import { executeMutation, readPreloadedQuery } from '#lib/queries/client.ts';
import { getUserConfigQuery } from '#lib/queries/config-user.query.ts';
import { updateUserAdminMutation } from '#lib/queries/user-admin.query.ts';
import { Route } from '#lib/route.ts';
import type { HeaderButtonActionItem } from '#lib/types.ts';
import { getFormatter } from '#lib/utils/i18n.ts';
import { UserStatus, type UserAdminResponseDto } from '@immich/sdk';
import { modalManager, type ActionItem } from '@immich/ui';
import {
  mdiAccountCancelOutline,
  mdiAccountCheckOutline,
  mdiChartPieOutline,
  mdiDeleteRestore,
  mdiInformationOutline,
  mdiLockReset,
  mdiLockSmart,
  mdiPencilOutline,
  mdiPlusBoxOutline,
  mdiTrashCanOutline,
} from '@mdi/js';
import { DateTime } from 'luxon';
import type { MessageFormatter } from 'svelte-i18n';
import { goto } from '$app/navigation';

export const getUserAdminsActions = ($t: MessageFormatter) => {
  const Create: ActionItem = {
    title: $t('create_user'),
    icon: mdiPlusBoxOutline,
    onAction: () => goto(Route.newUser()),
    shortcuts: { shift: true, key: 'n' },
  };

  return { Create };
};

export const getUserAdminActions = ($t: MessageFormatter, user: UserAdminResponseDto) => {
  const Detail: ActionItem = {
    icon: mdiInformationOutline,
    title: $t('details'),
    onAction: () => goto(Route.viewUser(user)),
  };

  const Update: ActionItem = {
    icon: mdiPencilOutline,
    title: $t('edit'),
    $if: () => !user.deletedAt,
    onAction: () => goto(Route.editUser(user)),
  };

  const AdjustQuota: ActionItem = {
    icon: mdiChartPieOutline,
    title: $t('adjust_quota'),
    $if: () => !user.deletedAt,
    onAction: () => modalManager.show(AdjustQuotaModal, { user }),
  };

  const Delete: ActionItem = {
    icon: mdiTrashCanOutline,
    title: $t('delete'),
    color: 'danger',
    $if: () => authManager.user.id !== user.id && !user.deletedAt,
    onAction: () => modalManager.show(UserDeleteConfirmModal, { user }),
    shortcuts: { key: 'Backspace' },
    shortcutOptions: { ignoreInputFields: true },
  };

  const getDeleteDate = (deletedAt: string): Date => {
    const userConfig = readPreloadedQuery(getUserConfigQuery());
    return DateTime.fromISO(deletedAt).plus({ days: userConfig.user.deleteDelay }).toJSDate();
  };

  const Restore: HeaderButtonActionItem = {
    icon: mdiDeleteRestore,
    title: $t('restore'),
    color: 'primary',
    data: {
      title: $t('admin.user_restore_scheduled_removal', { values: { date: getDeleteDate(user.deletedAt!) } }),
    },
    $if: () => !!user.deletedAt && user.status === UserStatus.Deleted,
    onAction: () => modalManager.show(UserRestoreConfirmModal, { user }),
  };

  const ResetPassword: ActionItem = {
    icon: mdiLockReset,
    title: $t('reset_password'),
    $if: () => authManager.user.id !== user.id && !user.deletedAt,
    onAction: () => handleResetPasswordUserAdmin(user),
  };

  const ResetPinCode: ActionItem = {
    icon: mdiLockSmart,
    title: $t('reset_pin_code'),
    $if: () => !user.deletedAt,
    onAction: () => handleResetPinCodeUserAdmin(user),
  };

  const Suspend: ActionItem = {
    icon: mdiAccountCancelOutline,
    title: $t('suspend'),
    color: 'danger',
    $if: () => authManager.user.id !== user.id && !user.deletedAt && (user.status as any) !== 'suspended',
    onAction: () => handleSuspendUserAdmin(user, true),
  };

  const Unsuspend: ActionItem = {
    icon: mdiAccountCheckOutline,
    title: $t('unsuspend'),
    color: 'primary',
    $if: () => authManager.user.id !== user.id && !user.deletedAt && (user.status as any) === 'suspended',
    onAction: () => handleSuspendUserAdmin(user, false),
  };

  return { Detail, Update, AdjustQuota, Delete, Restore, ResetPassword, ResetPinCode, Suspend, Unsuspend };
};

export const handleSuspendUserAdmin = async (user: UserAdminResponseDto, suspend: boolean) => {
  const status = suspend ? ('suspended' as any) : UserStatus.Active;
  await executeMutation(updateUserAdminMutation, [{ id: user.id, userAdminUpdateDto: { status } as any }]);
};

// TODO move password reset server-side
const generatePassword = (length: number = 16) => {
  let generatedPassword = '';

  const characterSet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ,.-{}+!#$%/()=?';

  for (let i = 0; i < length; i++) {
    const buffer = new Uint32Array(1);
    crypto.getRandomValues(buffer);
    let randomNumber = buffer[0];
    randomNumber /= 2 ** 32;
    randomNumber = Math.floor(randomNumber * characterSet.length);

    generatedPassword += characterSet[randomNumber];
  }

  return generatedPassword;
};

const handleResetPasswordUserAdmin = async (user: UserAdminResponseDto) => {
  const $t = await getFormatter();
  const password = generatePassword();
  await executeMutation(
    updateUserAdminMutation,
    [{ id: user.id, userAdminUpdateDto: { password, shouldChangePassword: true } }],
    {
      confirm: { prompt: $t('admin.confirm_user_password_reset', { values: { user: user.name } }) },
      onSuccess: () => void modalManager.show(PasswordResetSuccessModal, { newPassword: password }),
    },
  );
};

const handleResetPinCodeUserAdmin = async (user: UserAdminResponseDto) => {
  const $t = await getFormatter();
  await executeMutation(updateUserAdminMutation, [{ id: user.id, userAdminUpdateDto: { pinCode: null } }], {
    confirm: { prompt: $t('admin.confirm_user_pin_code_reset', { values: { user: user.name } }) },
  });
};
