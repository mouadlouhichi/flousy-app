export {
  DEFAULT_FROM,
  SANDBOX_SENDER,
  getEmailConfig,
  isProductionDeployment,
  probeEmailConfig,
  resolveAppBaseUrl,
  type EmailConfig,
  type EmailProbeCode,
} from './config';
export {
  escapeHtml,
  renderHouseholdInvite,
  type HouseholdInviteCopy,
  type HouseholdInviteInput,
  type RenderedEmail,
} from './templates/household-invite';
export { sendHouseholdInvite, type SendResult } from './send';
