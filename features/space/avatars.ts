import xiaoman from "./portraits/xiaoman.jpg";
import yizhou from "./portraits/yizhou.jpg";
import zhixia from "./portraits/zhixia.jpg";
import yian from "./portraits/yian.jpg";
import ops from "./portraits/ops.jpg";
import kexin from "./portraits/kexin.jpg";
import yuning from "./portraits/yuning.jpg";
import muyang from "./portraits/muyang.jpg";

// Explicit demo IDs: never assign someone else’s photo to a newly registered user.
export const demoPortraits: Record<string, string> = {
  "10000000-0000-4000-8000-000000000010": "/host-portraits/daniel.jpg",
  "10000000-0000-4000-8000-000000000011": "/host-portraits/sophie.jpg",
  "10000000-0000-4000-8000-000000000012": "/host-portraits/alex.jpg",
  "10000000-0000-4000-8000-000000000001": xiaoman.src,
  "10000000-0000-4000-8000-000000000002": yizhou.src,
  "10000000-0000-4000-8000-000000000003": zhixia.src,
  "10000000-0000-4000-8000-000000000004": yian.src,
  "10000000-0000-4000-8000-000000000005": "/host-portraits/emma.jpg",
  "10000000-0000-4000-8000-000000000006": ops.src,
  "10000000-0000-4000-8000-000000000007": kexin.src,
  "10000000-0000-4000-8000-000000000008": yuning.src,
  "10000000-0000-4000-8000-000000000009": muyang.src,
};
