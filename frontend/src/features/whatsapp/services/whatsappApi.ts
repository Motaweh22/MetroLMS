import { apiClient, type RequestOptions } from '@/core/api/apiClient';
import type {
  WhatsAppSupportScenario,
  UserWhatsAppVisibilityConfigDTO,
  SaveUserWhatsAppVisibilityPayload,
  PublicSupportContactsResponseDTO,
} from '../types';

/**
 * Centrally Managed WhatsApp Contact Visibility API Service (Increment 11 Phase 2)
 */
export const whatsappApi = {
  /**
   * Reads current WhatsApp scenario assignments for a user
   * Endpoint: GET /api/admin/users/:userId/whatsapp-visibility
   */
  async getUserWhatsAppVisibility(
    userId: string,
    options?: RequestOptions
  ): Promise<UserWhatsAppVisibilityConfigDTO> {
    return apiClient<UserWhatsAppVisibilityConfigDTO>(
      `/api/admin/users/${encodeURIComponent(userId)}/whatsapp-visibility`,
      {
        method: 'GET',
        ...options,
      }
    );
  },

  /**
   * Updates scenario assignments for a user
   * Endpoint: PUT /api/admin/users/:userId/whatsapp-visibility
   */
  async setUserWhatsAppVisibility(
    userId: string,
    payload: SaveUserWhatsAppVisibilityPayload,
    options?: RequestOptions
  ): Promise<UserWhatsAppVisibilityConfigDTO> {
    return apiClient<UserWhatsAppVisibilityConfigDTO>(
      `/api/admin/users/${encodeURIComponent(userId)}/whatsapp-visibility`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
        ...options,
      }
    );
  },

  /**
   * Public contact resolver for platform support scenarios
   * Endpoint: GET /api/public/support-contacts?scenario=<scenario>
   */
  async getPublicSupportContacts(
    scenario: WhatsAppSupportScenario,
    options?: RequestOptions
  ): Promise<PublicSupportContactsResponseDTO> {
    return apiClient<PublicSupportContactsResponseDTO>(
      `/api/public/support-contacts`,
      {
        method: 'GET',
        params: { scenario },
        ...options,
      }
    );
  },
};
