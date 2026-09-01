import { useEffect } from "react";
import { useBlocker, useLocation } from "react-router";
import {
  isPracticeLockedPath,
  usePracticeFlowLockStore,
} from "../utils/practiceFlowLock";

/**
 * 练习锁定页：拦截浏览器后退 / 路由离开，改为打开暂停菜单。
 * 练习流内部跳转（同属锁定路由）不拦截。
 */
export function usePracticeFlowGuard() {
  const location = useLocation();
  const locked = isPracticeLockedPath(location.pathname);

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (!isPracticeLockedPath(currentLocation.pathname)) return false;
    if (isPracticeLockedPath(nextLocation.pathname)) return false;
    if (usePracticeFlowLockStore.getState().consumeLeaveAllowance()) return false;
    return true;
  });

  useEffect(() => {
    if (!locked) return;
    if (blocker.state !== "blocked") return;
    usePracticeFlowLockStore.getState().requestPauseMenu();
    blocker.reset?.();
  }, [blocker, locked]);
}
