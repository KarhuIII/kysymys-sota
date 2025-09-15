import { writable } from 'svelte/store';
import type { Kayttaja } from '../database/schema.js';

type PickerState = {
  visible: boolean;
  kortti: any | null;
  players: Kayttaja[];
  confirmCallback: ((target: Kayttaja) => void) | null;
};

const defaultState: PickerState = {
  visible: false,
  kortti: null,
  players: [],
  confirmCallback: null
};

const { subscribe, set, update } = writable<PickerState>(defaultState);

export const targetPicker = {
  subscribe,
  open: (kortti: any, players: Kayttaja[], onConfirm: (t: Kayttaja) => void) => {
    set({ visible: true, kortti, players, confirmCallback: onConfirm });
  },
  close: () => set(defaultState),
};

export type { PickerState };
