/*
 *  Copyright 2023 LiteFarm.org
 *  This file is part of LiteFarm.
 *
 *  LiteFarm is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  LiteFarm is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 *  GNU General Public License for more details, see <https://www.gnu.org/licenses/>.
 */

import { RRule } from 'rrule';
import { getRruleLanguage } from '../../util/rruleTranslation';
import { getLanguageFromLocalStorage } from '../../util/getLanguageFromLocalStorage';
import { parseISOStringToLocalDate } from '../Form/Input/utils';

export const RRULEDAYS = {
  Sunday: 'SU',
  Monday: 'MO',
  Tuesday: 'TU',
  Wednesday: 'WE',
  Thursday: 'TH',
  Friday: 'FR',
  Saturday: 'SA',
};

const translationCache = {};

// Returns rrule language definition if already imported, otherwise loads and saves it to memory
const getTranslations = async (lang) => {
  if (translationCache[lang]) {
    return translationCache[lang];
  }
  const translation = await getRruleLanguage(lang);
  translationCache[lang] = translation;
  return translation;
};

export const getWeekday = (planStartDate) => {
  const date = new Date(parseISOStringToLocalDate(planStartDate));

  return date.toLocaleString('en', { weekday: 'long' });
};

export const getDate = (planStartDate) => {
  const date = new Date(parseISOStringToLocalDate(planStartDate));

  return date.getDate();
};

const calculateWeekdayOrdinal = (date) => {
  const dayOfMonth = date.getDate();

  let ordinal = Math.ceil(dayOfMonth / 7);

  // Check if the day is within the last 7 days of month
  const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  if (dayOfMonth > lastDayOfMonth.getDate() - 7) {
    // If within last week, return -1 as the ordinal
    ordinal = -1;
  }

  return ordinal;
};

export const calculateMonthlyOptions = async (planStartDate, repeatFrequency) => {
  const currentLang = getLanguageFromLocalStorage();

  const translations = await getTranslations(currentLang);

  const dt = parseISOStringToLocalDate(planStartDate);
  const weekday = RRULEDAYS[dt.toLocaleString('en', { weekday: 'long' })];
  const date = dt.getDate();
  const ordinal = calculateWeekdayOrdinal(dt);

  const dateRuleOptions = getTextRuleOptions('month', planStartDate, repeatFrequency);
  const dateString = new RRule(dateRuleOptions).toText(translations.getText, translations.language);

  const dayWeekRuleOptions = getTextRuleOptions('month', planStartDate, repeatFrequency, null, {
    weekday,
    ordinal,
  });
  const dayWeekString = new RRule(dayWeekRuleOptions).toText(
    translations.getText,
    translations.language,
  );

  return [
    {
      value: date,
      label: dateString,
    },
    {
      value: { ordinal, weekday },
      label: dayWeekString,
    },
  ];
};

export const countOccurrences = ({
  planStartDate,
  repeatFrequency,
  repeatInterval,
  daysOfWeek,
  monthRepeatOn,
  finishOnDate,
}) => {
  const textRuleOptions = getTextRuleOptions(
    repeatInterval.value,
    planStartDate,
    repeatFrequency,
    daysOfWeek,
    monthRepeatOn.value,
  );
  const occurencesRuleOptions = getOccurrencesRuleOptions(
    textRuleOptions,
    repeatInterval.value,
    planStartDate,
    'on',
    null,
    finishOnDate,
  );

  // new RRule().all() generates the array of occurrences
  return new RRule(occurencesRuleOptions).all().length;
};

const frequencyKeys = {
  day: 'DAILY',
  week: 'WEEKLY',
  month: 'MONTHLY',
  year: 'YEARLY',
};

/**
 * Function that returns an object that is used to create a rule (new RRule()) for generating text. *
 */
const getTextRuleOptions = (
  repeatInterval,
  startDate,
  repeatFrequency,
  daysOfWeek,
  monthRepeatOnValue,
) => {
  const options = {
    freq: RRule[frequencyKeys[repeatInterval]],
    interval: +repeatFrequency,
  };

  if (repeatInterval === 'day') {
    return options;
  }
  if (repeatInterval === 'week') {
    const [day] = daysOfWeek;
    return { ...options, byweekday: [RRule[RRULEDAYS[day]]] };
  }
  if (repeatInterval === 'month') {
    // Monthly pattern by week ordinal and day
    if (monthRepeatOnValue && isNaN(monthRepeatOnValue)) {
      const { weekday, ordinal } = monthRepeatOnValue;
      return {
        ...options,
        bymonthday: [],
        byweekday: [RRule[weekday].nth(ordinal)],
      };
    }

    // Monthly pattern by date
    const date = monthRepeatOnValue || parseISOStringToLocalDate(startDate).getDate();
    return {
      ...options,
      bymonthday: [date],
    };
  }
  if (repeatInterval === 'year') {
    const [, month, date] = startDate.split('-');
    return { ...options, bymonth: [+month], bymonthday: [+date] };
  }
};

const getOccurrencesRuleOptions = (
  textRuleOptions,
  repeatInterval,
  startDate,
  finish,
  count,
  endDate,
) => {
  let options = { ...textRuleOptions, dtstart: parseISOStringToLocalDate(startDate) };

  if (finish === 'on') {
    options.until = parseISOStringToLocalDate(endDate);
  } else {
    options.count = count;
  }

  if (repeatInterval === 'month' && textRuleOptions.bymonthday.length) {
    const [date] = textRuleOptions.bymonthday;
    const dayArray = [];

    // See stackoverflow.com/questions/35757778/rrule-for-repeating-monthly-on-the-31st-or-closest-day/35765662#35765662
    if (date > 28) {
      for (let i = 28; i <= date; i++) {
        dayArray.push(i); // e.g. [28, 29, 30]
      }
    } else {
      dayArray.push(date);
    }

    options = { ...options, bymonthday: dayArray, bysetpos: -1 };
  } else if (repeatInterval === 'year' && startDate.includes('02-29')) {
    options = { ...options, bymonthday: [28, 29], bysetpos: -1 };
  }

  return options;
};

export const getTextAndOccurrences = (
  repeatInterval,
  startDate,
  repeatFrequency,
  finish,
  count,
  endDate,
  daysOfWeek,
  monthRepeatOn,
) => {
  const textRuleOptions = getTextRuleOptions(
    repeatInterval,
    startDate,
    repeatFrequency,
    daysOfWeek,
    monthRepeatOn,
  );

  const occurrencesRuleOptions = getOccurrencesRuleOptions(
    textRuleOptions,
    repeatInterval,
    startDate,
    finish,
    count,
    endDate,
  );

  return {
    text: new RRule(textRuleOptions).toText(),
    occurrences: new RRule(occurrencesRuleOptions).all(),
  };
};
