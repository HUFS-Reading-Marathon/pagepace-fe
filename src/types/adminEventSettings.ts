export type EventSettings = {
  eventStartDate: string;
  eventEndDate: string;
  applyStartDate: string;
  applyEndDate: string;
  courseStandards: {
    short: number;
    half: number;
    full: number;
  };
  rewardStandard: string;
};

export const EVENT_SETTINGS_STORAGE_KEY = 'eventSettings';

export const DEFAULT_EVENT_SETTINGS: EventSettings = {
  eventStartDate: '',
  eventEndDate: '',
  applyStartDate: '',
  applyEndDate: '',
  courseStandards: {
    short: 2000,
    half: 4220,
    full: 8439,
  },
  rewardStandard: '',
};

