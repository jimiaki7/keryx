// 礼拝順序の初期テンプレート（KX-014）。
// よく使う順序のカスタム保存（service_templates テーブル）は P1 で追加する。

export type ServiceTemplateElement = {
  type: string;
  title: string;
};

export type ServiceTemplate = {
  key: string;
  label: string;
  elements: readonly ServiceTemplateElement[];
};

export const SERVICE_TEMPLATES: readonly ServiceTemplate[] = [
  {
    key: 'sunday_worship',
    label: '主日礼拝',
    elements: [
      { type: 'call_to_worship', title: '' },
      { type: 'hymn', title: '開会賛美' },
      { type: 'prayer', title: '開会の祈り' },
      { type: 'responsive_reading', title: '' },
      { type: 'hymn', title: '賛美' },
      { type: 'scripture_reading', title: '' },
      { type: 'message', title: '' },
      { type: 'hymn', title: '応答賛美' },
      { type: 'offering', title: '' },
      { type: 'doxology', title: '' },
      { type: 'benediction', title: '' },
    ],
  },
  {
    key: 'prayer_meeting',
    label: '祈祷会',
    elements: [
      { type: 'hymn', title: '賛美' },
      { type: 'prayer', title: '開会の祈り' },
      { type: 'scripture_reading', title: '' },
      { type: 'message', title: '奨励' },
      { type: 'hymn', title: '賛美' },
      { type: 'prayer', title: '祈りの時' },
      { type: 'benediction', title: '' },
    ],
  },
];

export function serviceTemplateFor(key: string): ServiceTemplate | undefined {
  return SERVICE_TEMPLATES.find((t) => t.key === key);
}
