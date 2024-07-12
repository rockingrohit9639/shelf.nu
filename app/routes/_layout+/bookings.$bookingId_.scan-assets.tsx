import { BookingStatus, OrganizationRoles } from "@prisma/client";
import { json } from "@remix-run/node";
import type { MetaFunction, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { z } from "zod";
import Header from "~/components/layout/header";
import type { HeaderData } from "~/components/layout/header/types";
import { Badge } from "~/components/shared/badge";
import { Spinner } from "~/components/shared/spinner";
import { ZXingScanner } from "~/components/zxing-scanner";
import { useQrScanner } from "~/hooks/use-qr-scanner";
import { useViewportHeight } from "~/hooks/use-viewport-height";
import { getBooking } from "~/modules/booking/service.server";
import { appendToMetaTitle } from "~/utils/append-to-meta-title";
import { makeShelfError, ShelfError } from "~/utils/error";
import { data, error, getParams } from "~/utils/http.server";
import {
  PermissionAction,
  PermissionEntity,
} from "~/utils/permissions/permission.validator.server";
import { requirePermission } from "~/utils/roles.server";
import { bookingStatusColorMap } from "./bookings";

export async function loader({ context, request, params }: LoaderFunctionArgs) {
  const authSession = context.getSession();
  const { userId } = authSession;

  const { bookingId } = getParams(params, z.object({ bookingId: z.string() }), {
    additionalData: { userId },
  });

  try {
    const { organizationId, role } = await requirePermission({
      userId,
      request,
      entity: PermissionEntity.booking,
      action: PermissionAction.update,
    });

    const isSelfService = role === OrganizationRoles.SELF_SERVICE;

    const booking = await getBooking({
      id: bookingId,
      organizationId: organizationId,
    });

    // Self service can only manage assets for bookings that are DRAFT
    const canManageAssetsAsSelfService =
      isSelfService && booking.status !== BookingStatus.DRAFT;

    const isCompleted = booking.status === BookingStatus.COMPLETE;
    const isArchived = booking.status === BookingStatus.ARCHIVED;

    const canManageAssets =
      !!booking.from &&
      !!booking.to &&
      !isCompleted &&
      !isArchived &&
      !canManageAssetsAsSelfService;

    if (!canManageAssets) {
      throw new ShelfError({
        cause: null,
        message:
          "You are not allowed to manage assets for this booking at the moment.",
        label: "Booking",
        shouldBeCaptured: false,
      });
    }

    const header: HeaderData = {
      title: `Scan assets for booking | ${booking.name}`,
    };

    return json(data({ header, booking }));
  } catch (cause) {
    const reason = makeShelfError(cause, { userId, bookingId });
    throw json(error(reason), { status: reason.status });
  }
}

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data ? appendToMetaTitle(data.header.title) : "" },
];

export const handle = {
  breadcrumb: () => "single",
};

export default function ScanAssetsForBookings() {
  const { booking } = useLoaderData<typeof loader>();

  const { videoMediaDevices } = useQrScanner();
  const { vh, isMd } = useViewportHeight();
  const height = isMd ? vh - 140 : vh - 167;

  return (
    <>
      <Header
        title={`Scan assets to add into booking "${booking.name}"`}
        subHeading={
          <div className="flex items-center gap-2">
            <Badge color={bookingStatusColorMap[booking.status]}>
              <span className="block lowercase first-letter:uppercase">
                {booking.status}
              </span>
            </Badge>
          </div>
        }
      />

      <div
        className={` -mx-4 flex flex-col`}
        style={{
          height: `${height}px`,
        }}
      >
        {videoMediaDevices && videoMediaDevices.length > 0 ? (
          <ZXingScanner
            videoMediaDevices={videoMediaDevices}
            onQrDetectionSuccess={console.log}
          />
        ) : (
          <div className="mt-4 flex flex-col items-center justify-center">
            <Spinner /> Waiting for permission to access camera.
          </div>
        )}
      </div>
    </>
  );
}