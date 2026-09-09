import { trpc } from "../trpc";
import { formatMoney as formatMoneyShared } from "@thoth/shared";

export function useSettings() {
  const query = trpc.settings.get.useQuery();
  return query;
}

export function useFormatMoney() {
  const { data } = useSettings();
  const currency = data?.currency ?? "$";
  return (cents: number) => formatMoneyShared(cents, currency);
}
