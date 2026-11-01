/** Fixed source-owned query subview metadata; never scene/request data. */
export const QUERY_VIEW_MAGIC=0x48515631;
export const queryViewWords=rail=>{if(!Number.isInteger(rail)||rail<0||rail>3)throw Error("Exact query rail required");return new Uint32Array([QUERY_VIEW_MAGIC,rail*256,256,1024]);};
