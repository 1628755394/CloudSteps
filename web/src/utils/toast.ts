import { toast } from "sonner";

/**
 * 统一的消息提示工具，替代浏览器原生 alert/confirm。
 * 基于 sonner，支持中文友好提示。
 */
export const showToast = {
  success(msg: string) {
    toast.success(msg);
  },
  error(msg: string) {
    toast.error(msg);
  },
  warning(msg: string) {
    toast.warning(msg);
  },
  info(msg: string) {
    toast.info(msg);
  },
  /** 加载中提示，返回 dismiss 函数 */
  loading(msg: string) {
    return toast.loading(msg);
  },
};

export { toast };
