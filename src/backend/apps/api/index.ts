import { title } from 'process';
import { FS } from '../../_shared/fs/fs';
import { getResponse } from '../../_shared/http/http';
import { LOG } from '../../_shared/log/log';
const HTMLParser = require('node-html-parser');
import {
    SESSIONS_DATA,
    SESSION,
    SPEAKER,
    LINK_TARGETS,
    CONFERENCES,
} from '../api/index.d';
import { countryFlags, TAGS } from './index.config';

const REGEX_SPEAKER: RegExp =
    /^(?<name>.+?)\s*-\s*(?<role>[^,|]+),\s*(?<company>[^|]+)\s*\|\s*(?<country>.+)$/;
const doForce = process.argv.indexOf('--force') !== -1;

const TARGETS: LINK_TARGETS = [
    {
        key: 'ng-poland',
        value: 'https://ng-poland.pl/',
        logo: 'https://ng-poland.pl/images/logos/logo-small-2024.webp',
        color: '#F230BF',
        colorSecondary: '#A127F2',
    },
    {
        key: 'ai-poland',
        value: 'https://ai-poland.pl/sessions/',
        logo: 'https://ai-poland.pl/images/logos/ai-poland-logo-small.webp',
        color: '#5C44E4',
        colorSecondary: '#A127F2',
    },
    {
        key: 'js-poland',
        value: 'https://js-poland.pl/sessions/',
        logo: 'https://js-poland.pl/images/logos/logo-small.png',
        color: '#dc3c1e',
        colorSecondary: '#ab270f',
    },
];

const SOCIALS = [
    'linkedin',
    'twitter',
    'github',
    'facebook',
    'instagram',
    'youtube',
    'x.com',
];

export const getNextContent = (item: HTMLElement): string => {
    const nextItem = item.nextElementSibling as HTMLElement;
    if (nextItem && nextItem.tagName !== 'H3') {
        return nextItem.innerText.trim();
        // return nextItem.text.trim();
    }
    return '';
};
export const getID = (str: string): string => {
    return str
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9\-]/g, '');
};
export const sanitizeText = (str: string): string => {

    return str?.replace(/[\r|\n]+/g, '').trim() || '';
};
export const getLink = (
    item: HTMLAnchorElement,
    condition: string
): string | null => {
    if (item) {
        const link = item.getAttribute('href');
        if (link && link.indexOf(condition) !== -1) {
            return link;
        }
    }
    return null;
};
const SESSION_FILE = `./src/_data/sessions.json`;

const conferences: CONFERENCES = {};
for (const target of TARGETS) {
    conferences[target.key] = target;
}

const DATA: SESSIONS_DATA = {
    links: [],
    sessions: {},
    speakers: {},
    conferences,
};
export const main = (TARGETS: LINK_TARGETS) => {
    for (const target of TARGETS) {
        const conferenceID = target.key;

        // sessions
        const httpItemSessions = getResponse(`${target.value}/sessions`);
        if (httpItemSessions) {
            const html = httpItemSessions.content || '';
            const root = HTMLParser.parse(html);
            const sessionElements = root.querySelectorAll('#sessions div > a');
            sessionElements.map((el: any) => {
                const href = getLink(el, '/speaker/');
                if (href && DATA.links.indexOf(href) === -1) {
                    DATA.links.push(href);
                }
            });
            for (const link of DATA.links) {
                const httpSession = getResponse(link);
                const sessionHtml = httpSession.content || '';
                const sessionRoot = HTMLParser.parse(sessionHtml);
                const titles = sessionRoot.querySelectorAll('#speaker h3');
                const img = sessionRoot.querySelector('#speaker img');
                const speaker: SPEAKER = {
                    id: null,
                    name: '',
                    bio: '',
                    role: '',
                    company: '',
                    country: '',
                    flag: '',
                    image: '',
                    socials: {},
                    action: [],
                    sessions: [],
                };
                let session: SESSION = {
                    title: '',
                    description: '',
                    conference: conferenceID,
                    href: link,
                    block: '',
                    start: '',
                    end: '',
                    day: '',
                    startTime: '',
                    endTime: '',
                    id: null,
                    speakerID: null,
                    tags: [],
                };
                const warnings = [];
                if (img && img.attributes && img.attributes.src) {
                    speaker.image = img.attributes.src;
                    if(!speaker.image || speaker.image.indexOf('http')===-1){
                        warnings.push(`🖼️ [${speaker.id}] Invalid speaker image URL: ${speaker.image}`);
                    }

                    const parent = img.parentNode;
                    const links = parent.querySelectorAll('a');
                    for (const a of links) {
                        const href =
                            a && a.attributes && a.attributes.href
                                ? a.attributes.href
                                : null;
                        if (href) {
                            for (const social of SOCIALS) {
                                if (href.indexOf(social) !== -1) {
                                    speaker.socials[social] = href;
                                }
                            }
                        } else {
                            warnings.push(`🔗 No href for social link: ${a}`);
                        }
                    }
                }
                for (const title of titles) {
                    const i = title.querySelector('i');
                    const css = i.getAttribute('class') || '';
                    // console.log('CSS:', css);

                    const str = title.text;
                    if (css.indexOf('fa-microphone') !== -1) {
                        session.title = sanitizeText(str);
                        session.description = getNextContent(title);
                        session.id = getID(session.title);
                    } else if (css.indexOf('fa-star') !== -1) {
                        const match = str.match(REGEX_SPEAKER);
                        if(!match){
                            LOG.WARN(`Speaker info not matched: ${str}`);
                            const parts = str.split('-');
                            const nameOnly = parts[0];
                            const otherPart = str.replace(nameOnly, '').trim();
                            const country = otherPart.match(/[,|]+\s[^,|]+$/);
                            if(country){
                                speaker.country = sanitizeText(country[0].replace(/[,|]+/,''));
                                speaker.flag = countryFlags[speaker.country]?.flag;
                                const rest = otherPart.replace(/[,|]+\s[^,|]+$/,'').trim();
                                if(rest.indexOf(',')!==-1){
                                    speaker.role = sanitizeText(rest);
                                } else {
                                    speaker.company = sanitizeText(rest);
                                }
                            }
                            speaker.name = sanitizeText(nameOnly);
                        } else {
                            const item = match?.groups || {};
                            speaker.name = sanitizeText(item.name);
                            speaker.company = sanitizeText(item.company);
                            speaker.country = sanitizeText(item.country);
                            speaker.role = sanitizeText(item.role);
                        }
                        speaker.id = getID(speaker.name);
                        session.speakerID = speaker.id;

                        speaker.bio = getNextContent(title);
                    } else if (css.indexOf('fa-book') !== -1) {
                        const next = title.nextElementSibling;
                        if (next && next.tagName !== 'H3') {
                            const iframe = next.querySelector('iframe');
                            if (
                                iframe &&
                                iframe.attributes &&
                                iframe.attributes.src
                            ) {
                                speaker.action.push(iframe.attributes.src);
                            }
                        }
                        // ignore for now
                    }
                }
                const keysSpeaker = Object.keys(speaker);
                for (const key of keysSpeaker) {
                    if (speaker[key as keyof SPEAKER] === '') {
                        warnings.push(`🧑 [${speaker.id}] Missing value ${key}`);
                    }
                }
                const keysSession = Object.keys(session);
                for (const key of keysSession) {
                    if (session[key as keyof SESSION] === '') {
                        warnings.push(
                            `🎙️ [${session.speakerID}] Missing session value ${key}`
                        );
                    }
                }
                for (const TAG of TAGS) {
                    const tag = TAG.toLowerCase();
                    const d = session.description.toLowerCase();
                    const ti = session.title.toLowerCase();
                    if (d.indexOf(tag) !== -1 || ti.indexOf(tag) !== -1) {
                        session.tags.push(TAG);
                        // LOG.INFO(`Tag matched: ${tag} in session ${session.id}`);
                    }
                }
                for (const warning of warnings) {
                    LOG.WARN(warning);
                }
                if (session.id) {
                    if (!DATA.sessions[session.id]) {
                        DATA.sessions[session.id] = { ...session };
                    }
                }
                if (speaker.id) {
                    LOG.OK(`Processing session link: ${link}`);
                    if (!DATA.speakers[speaker.id]) {
                        DATA.speakers[speaker.id] = { ...speaker };
                    }
                    const speakerItem = DATA.speakers[speaker.id];
                    if (session.id) {
                        if (speakerItem.sessions.indexOf(session.id) === -1) {
                            speakerItem.sessions.push(session.id);
                        }
                    }
                } else {
                    LOG.WARN(`Missing speaker ID for session: ${link}`);
                }
            }
        }
        const httpItemSchedule = getResponse(`${target.value}/#schedule`);
        if (httpItemSchedule) {
            const html = httpItemSchedule.content || '';
            const root = HTMLParser.parse(html);
            const scheduleElements = root.querySelectorAll('.timeline-panel');
            for (const el of scheduleElements) {
                const blockEl = el.querySelector('h3');
                const timeEl = el.querySelector('h5');
                const talks = el.querySelectorAll('img + strong');
                // console.log('Schedule block:', blockEl?.innerText.trim());
                // console.log('Schedule time:', timeEl?.innerText.trim());
                for (const talk of talks) {
                    // get text next strong
                    const talkTitle = talk.nextSibling.textContent; //;
                    // console.log(talkTitle);
                    const talkID = getID(talkTitle.trim().replace(/^\s*\-/, '').trim());
                    // console.log(` - Speaker: ${talk.innerText.trim()} => ${talkID}`);
                    if (DATA.sessions[talkID]) {
                        DATA.sessions[talkID].block = blockEl?.innerText.trim() || '';
                        const dayTime = sanitizeText(timeEl?.innerText || '').replace(/[\s]{2,}/, '|');
                        const dateTimeItems = dayTime.split('|');
                        const day = dateTimeItems[0].trim().replace(/,$/, '');
                        const times = dateTimeItems[1]?.trim().split('-') || [];
                        const startTime = times[0]?.trim() || '';
                        const endTime = times[1]?.trim() || '';
                        DATA.sessions[talkID].endTime = endTime;
                        DATA.sessions[talkID].startTime = startTime;
                        if (times.length === 2) {
                            DATA.sessions[talkID].start = `${day} ${startTime}`;
                            DATA.sessions[talkID].end = `${day} ${endTime}`;
                        } else {
                            LOG.WARN(`Invalid time format for talk ID ${talkID}: ${dateTimeItems[1]}`);
                        }
                        const readbaleDateTime = new Date(dateTimeItems.join(' ').trim());
                        // console.log('dt', dayTime);
                        DATA.sessions[talkID].day = day;
                    } else {
                        // console.log(`   ❌ No session found for talk ID: ${talkID}`);
                    }
                }
            }
        }

        // schedule
    }
    // iterate over all sessions
    for (const sessionID in DATA.sessions) {
        const session = DATA.sessions[sessionID];
        if (!session.start || !session.end) {
            LOG.WARN(`Missing start or end time for session ID: ${sessionID}`);
        }
    }
};
if (!FS.hasFile(SESSION_FILE) || doForce) {
    LOG.OK(`Generating session data file: ${SESSION_FILE}`);
    main(TARGETS);
    FS.writeFile(SESSION_FILE, JSON.stringify(DATA, null, 2));
} else {
    LOG.OK(`Loading existing session data file: ${SESSION_FILE}`);
}
