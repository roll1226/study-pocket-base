import PocketBase from "pocketbase";

const POCKETBASE_URL = import.meta.env.VITE_POCKETBASE_URL;

const pb = new PocketBase(POCKETBASE_URL);
// Avoid auto-cancelling duplicate requests while components rerender.
pb.autoCancellation(false);

export default pb;
