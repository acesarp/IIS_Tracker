// The app is served under guto.ca/mission-control (IIS forwards that path to the container).
// Next applies it to pages and <Link>s automatically, but not to fetch() calls, so client code
// prefixes its API URLs with it.
export const BASE_PATH = "/mission-control";
