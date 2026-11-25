import Classic from './classic/Invitation.astro';

export const templates = { classic: Classic };

export const resolveTemplate = (key) =>
  Object.hasOwn(templates, key) ? templates[key] : templates.classic;