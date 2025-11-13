export type SPEAKER = {
    id: string | null;
    name: string;
    bio: string;
    role: string;
    company: string;
    country: string;
    image: string;
    socials: Record<string, string>;
    action: string[];
    sessions: string[];
};
export type SESSION = {
    id: string | null;
    title: string;
    description: string;
    conference: string;
    speakerID: string | null;
    href: string;
    tags: string[];
};
export type SESSIONS = {
    [key: string]: SESSION;
};
export type SPEAKERS = {
    [key: string]: SPEAKER;
};
export type CONFERENCES = {
    [key: string]: LINK_TARGET;
};
export type SESSIONS_DATA = {
    links: string[];
    sessions: SESSIONS;
    speakers: SPEAKERS;
    conferences: CONFERENCES;
    tags: string[];
};
export type LINK_TARGET = {
    key: string;
    value: string;
    logo: string;
    color: string;
    colorSecondary: string;
};
export type LINK_TARGETS = LINK_TARGET[];
