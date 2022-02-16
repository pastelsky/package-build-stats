declare function getParseTime(currentScript: string, trialCount?: number): {
    baseParseTime: number;
    scriptParseTime: number;
} | {
    baseParseTime?: undefined;
    scriptParseTime?: undefined;
};
export default getParseTime;
