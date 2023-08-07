import { Form, useLoaderData } from "@remix-run/react";
import type Stripe from "stripe";
import type { loader } from "~/routes/_layout+/settings.subscription";
import { tw } from "~/utils";
import { FREE_PLAN } from "./helpers";
import { Button } from "../shared";

export type PriceWithProduct = Stripe.Price & {
  product: Stripe.Product;
};

export const Prices = ({ prices }: { prices: PriceWithProduct[] }) => (
  <div className="flex justify-between gap-5">
    <Price key={FREE_PLAN.id} price={FREE_PLAN} />
    {prices.map((price, index) => (
      <Price
        key={price.id}
        price={price}
        previousPlanName={prices[index - 1]?.product.name}
      />
    ))}
  </div>
);

export const Price = ({
  price,
  // features,
  previousPlanName,
}: {
  price: {
    id: string;
    product: {
      name: string;
      metadata: {
        features?: string;
      };
    };
    unit_amount: number | null;
    currency: string;
    recurring?: {
      interval: string;
    } | null;
  };
  previousPlanName?: string;
}) => {
  const { activeSubscription } = useLoaderData<typeof loader>();
  const activePlan = activeSubscription?.items.data[0]?.plan;
  const isFreePlan = price.id != "free";
  const features = price.product.metadata.features?.split(",") || [];
  return (
    <div
      key={price.id}
      className={tw(
        " w-full bg-gray-100 p-4",
        activePlan?.id === price.id && "border-2 border-primary-500",
        !activeSubscription &&
          price.id === "free" &&
          "border-2 border-primary-500"
      )}
    >
      <div>
        <h3>{price.product.name}</h3>
      </div>
      {price.unit_amount != null ? (
        <>
          <div className="text-xl">
            {price.unit_amount / 100} {price.currency}
          </div>
          {price.recurring ? <div>per {price.recurring.interval}</div> : null}
        </>
      ) : null}
      <div>
        {!activeSubscription && isFreePlan && (
          <Form method="post">
            <input type="hidden" name="priceId" value={price.id} />
            <Button type="submit">Get started</Button>
          </Form>
        )}
      </div>
      {features ? (
        <ul className="mt-4">
          {isFreePlan ? (
            <li>
              <b>All features from {previousPlanName || "Free"} plan</b>
            </li>
          ) : null}

          {features.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};