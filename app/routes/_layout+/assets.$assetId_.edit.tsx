import { useMemo } from "react";
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useAtomValue } from "jotai";
import { z } from "zod";
import { dynamicTitleAtom } from "~/atoms/dynamic-title-atom";
import { AssetForm, NewAssetFormSchema } from "~/components/assets/form";

import Header from "~/components/layout/header";
import type { HeaderData } from "~/components/layout/header/types";
import {
  getAllEntriesForCreateAndEdit,
  getAsset,
  updateAsset,
  updateAssetMainImage,
} from "~/modules/asset";

import { getActiveCustomFields } from "~/modules/custom-field";
import { getOrganization } from "~/modules/organization";
import { buildTagsSet } from "~/modules/tag";
import {
  assertIsPost,
  data,
  error,
  getParams,
  parseData,
  slugify,
} from "~/utils";
import { appendToMetaTitle } from "~/utils/append-to-meta-title";
import {
  extractCustomFieldValuesFromPayload,
  mergedSchema,
} from "~/utils/custom-fields";
import { sendNotification } from "~/utils/emitter/send-notification.server";
import { makeShelfError } from "~/utils/error";
import { PermissionAction, PermissionEntity } from "~/utils/permissions";
import { requirePermission } from "~/utils/roles.server";

export async function loader({ context, request, params }: LoaderFunctionArgs) {
  const authSession = context.getSession();
  const { userId } = authSession;
  const { assetId: id } = getParams(params, z.object({ assetId: z.string() }), {
    additionalData: { userId },
  });

  try {
    const { organizationId } = await requirePermission({
      userId,
      request,
      entity: PermissionEntity.asset,
      action: PermissionAction.update,
    });

    const [organization, asset] = await Promise.all([
      getOrganization({ id: organizationId, userId }),
      getAsset({ organizationId, id }),
    ]);

    const {
      categories,
      totalCategories,
      tags,
      locations,
      totalLocations,
      customFields,
    } = await getAllEntriesForCreateAndEdit({
      request,
      organizationId,
      defaults: {
        category: asset.categoryId,
        location: asset.locationId,
      },
    });

    const header: HeaderData = {
      title: `Edit | ${asset.title}`,
      subHeading: asset.id,
    };

    return json(
      data({
        asset,
        header,
        categories,
        totalCategories,
        tags,
        totalTags: tags.length,
        locations,
        totalLocations,
        currency: organization?.currency,
        customFields,
      })
    );
  } catch (cause) {
    const reason = makeShelfError(cause, { userId, id });
    throw json(error(reason), { status: reason.status });
  }
}

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: data ? appendToMetaTitle(data.header.title) : "" },
];

export const handle = {
  breadcrumb: () => "single",
};

export async function action({ context, request, params }: ActionFunctionArgs) {
  const authSession = context.getSession();
  const { userId } = authSession;
  const { assetId: id } = getParams(params, z.object({ assetId: z.string() }), {
    additionalData: { userId },
  });

  try {
    assertIsPost(request);

    const { organizationId } = await requirePermission({
      userId,
      request,
      entity: PermissionEntity.asset,
      action: PermissionAction.update,
    });

    const clonedRequest = request.clone();
    const formData = await clonedRequest.formData();

    const customFields = await getActiveCustomFields({
      organizationId,
    });

    const FormSchema = mergedSchema({
      baseSchema: NewAssetFormSchema,
      customFields: customFields.map((cf) => ({
        id: cf.id,
        name: slugify(cf.name),
        helpText: cf?.helpText || "",
        required: cf.required,
        type: cf.type.toLowerCase() as "text" | "number" | "date" | "boolean",
        options: cf.options,
      })),
    });

    const payload = parseData(formData, FormSchema, {
      additionalData: { userId, organizationId },
    });

    const customFieldsValues = extractCustomFieldValuesFromPayload({
      payload,
      customFieldDef: customFields,
    });

    await updateAssetMainImage({
      request,
      assetId: id,
      userId: authSession.userId,
    });

    const {
      title,
      description,
      category,
      newLocationId,
      currentLocationId,
      valuation,
    } = payload;

    /** This checks if tags are passed and build the  */
    const tags = buildTagsSet(payload.tags);

    await updateAsset({
      id,
      title,
      description,
      categoryId: category,
      tags,
      newLocationId,
      currentLocationId,
      userId: authSession.userId,
      customFieldsValues,
      valuation,
    });

    sendNotification({
      title: "Asset updated",
      message: "Your asset has been updated successfully",
      icon: { name: "success", variant: "success" },
      senderId: authSession.userId,
    });

    if (payload.addAnother) {
      return redirect(`/assets/new`);
    }

    return redirect(`/assets/${id}`);
  } catch (cause) {
    const reason = makeShelfError(cause, { userId, id });
    return json(error(reason), { status: reason.status });
  }
}

export default function AssetEditPage() {
  const title = useAtomValue(dynamicTitleAtom);
  const hasTitle = title !== "";
  const { asset } = useLoaderData<typeof loader>();
  const tags = useMemo(
    () => asset.tags?.map((tag) => ({ label: tag.name, value: tag.id })) || [],
    [asset.tags]
  );

  return (
    <>
      <Header title={hasTitle ? title : asset.title} />
      <div className=" items-top flex justify-between">
        <AssetForm
          title={asset.title}
          category={asset.categoryId}
          location={asset.locationId}
          description={asset.description}
          valuation={asset.valuation}
          tags={tags}
        />
      </div>
    </>
  );
}
