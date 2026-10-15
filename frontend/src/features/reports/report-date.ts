const dateOptions: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Jakarta',
};

const formatter = new Intl.DateTimeFormat('en-GB', dateOptions);
const decisionFormatter = new Intl.DateTimeFormat('en-GB', {
  ...dateOptions,
  second: '2-digit',
});

export function formatReportDate(value: string): string {
  return `${formatter.format(new Date(value))} WIB`;
}

export function formatDecisionDate(value: string): string {
  return `${decisionFormatter.format(new Date(value))} WIB`;
}
