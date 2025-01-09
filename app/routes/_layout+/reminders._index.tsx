import { json } from "@remix-run/node";
import type {
  MetaFunction,
  LoaderFunctionArgs,
  ActionFunctionArgs,
} from "@remix-run/node";
import RemindersTable from "~/components/asset-reminder/reminders-table";
import Header from "~/components/layout/header";
import type { HeaderData } from "~/components/layout/header/types";
import { ListContentWrapper } from "~/components/list/content-wrapper";
import { Filters } from "~/components/list/filters";
import { getPaginatedAndFilterableReminders } from "~/modules/asset-reminder/service.server";
import { resolveRemindersActions } from "~/modules/asset-reminder/utils.server";
import { appendToMetaTitle } from "~/utils/append-to-meta-title";
import { getDateTimeFormat } from "~/utils/client-hints";
import { makeShelfError } from "~/utils/error";
import { data, error } from "~/utils/http.server";
import {
  PermissionAction,
  PermissionEntity,
} from "~/utils/permissions/permission.data";
import { requirePermission } from "~/utils/roles.server";

export async function loader({ context, request }: LoaderFunctionArgs) {
  const authSession = context.getSession();
  const { userId } = authSession;

  try {
    const { organizationId } = await requirePermission({
      userId,
      request,
      entity: PermissionEntity.assetReminders,
      action: PermissionAction.read,
    });

    const { page, perPage, reminders, totalPages, totalReminders } =
      await getPaginatedAndFilterableReminders({
        organizationId,
        request,
      });

    const header: HeaderData = { title: "Reminders" };
    const modelName = {
      singular: "reminder",
      plural: "reminders",
    };

    const assetReminders = reminders.map((reminder) => ({
      ...reminder,
      displayDate: getDateTimeFormat(request, {
        dateStyle: "short",
        timeStyle: "short",
      }).format(reminder.alertDateTime),
    }));

    return json(
      data({
        header,
        modelName,
        items: assetReminders,
        totalItems: totalReminders,
        page,
        perPage,
        totalPages,
        searchFieldLabel: "Search reminders",
        searchFieldTooltip: {
          title: "Search reminders",
          text: "You can search reminders by reminder name, message, asset name or team member name. Simply separate your keywords by a space: 'Laptop maintenance'.",
        },
      })
    );
  } catch (cause) {
    const reason = makeShelfError(cause, { userId });
    throw json(error(reason), { status: reason.status });
  }
}

export async function action({ context, request }: ActionFunctionArgs) {
  const authSession = context.getSession();
  const userId = authSession.userId;

  try {
    const { organizationId } = await requirePermission({
      userId,
      request,
      entity: PermissionEntity.asset,
      action: PermissionAction.update,
    });

    return await resolveRemindersActions({
      request,
      organizationId,
      userId,
    });
  } catch (cause) {
    const reason = makeShelfError(cause, { userId });
    return json(error(reason), { status: reason.status });
  }
}

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: appendToMetaTitle(data?.header.title) },
];

export default function Reminders() {
  return (
    <>
      <Header />

      <ListContentWrapper className="mb-4">
        <Filters />
      </ListContentWrapper>

      <RemindersTable />
    </>
  );
}