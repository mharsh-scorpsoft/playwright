import { test, expect } from "@playwright/test";
import { runTimcoOrder } from "../src/timco/runTimcoOrder.js";

test("Timco order end-to-end", async ({ page }) => {
  test.setTimeout(90000);

  const payload = {
    orderId: "4686",
    address: {
      contact_details: {
        first_name: "Diane",
        last_name: "Kibble",
        email: "timco@tco.co.uk",
        company: " ",
        phone_number: "07907141598",
        mobile_number: "07907141598",
      },
      address_search: {
        country: "United Kingdom",
        postcode: "CM9 4AN",
      },
      your_address: {
        address_1: "26 Colchester Road",
        address_2: "Heybridge ebaylpcj7cr",
        city: "MALDON",
        postcode: "CM9 4AN",
        country: "United Kingdom",
        county: "Other",
      },
    },
    csvData: { LOC1210W: "1" },
  };

  const result = await runTimcoOrder(page, payload);
  console.log(result);
  expect(result.success).toBeTruthy();
});
