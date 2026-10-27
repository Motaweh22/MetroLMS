import React from 'react';
import { UserPermissionsModal, type UserPermissionsModalProps } from './UserPermissionsModal';

export type UserOverrideModalProps = UserPermissionsModalProps;

export const UserOverrideModal: React.FC<UserOverrideModalProps> = (props) => {
  return <UserPermissionsModal {...props} />;
};

export default UserOverrideModal;
