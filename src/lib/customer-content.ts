/** Customer policy and help copy. Operator-specific facts come from public configuration. */
export const POLICY_VERSION_DATE = "2026-11-26";

export type CustomerPolicySection = {
  heading: string;
  paragraphs?: readonly string[];
  bullets?: readonly string[];
  withoutLocations?: {
    heading?: string;
    paragraphs?: Readonly<Partial<Record<number, string>>>;
    bullets?: Readonly<Partial<Record<number, string>>>;
  } | null;
};

export type CustomerPolicyPage = {
  slug: string;
  title: string;
  description: string;
  sections: readonly CustomerPolicySection[];
  withoutLocations?: { title: string; description: string };
};

export const PUBLIC_POLICY_PAGES = [
  {
    slug: "privacy",
    title: "Privacy notice",
    description:
      "How Grill & Swill uses order, contact, browser and support information, and how to ask about your data.",
    sections: [
      {
        heading: "About this notice",
        paragraphs: [
          "This notice explains information used when you browse Grill & Swill, place an order, use device-based rewards, send a catering or support request, or interact with the gallery. It also explains information that can remain in your browser. Use Support for privacy questions or requests relating to your information.",
          "You can browse without creating a customer account. Guest checkout still uses contact information and a browser identifier; it does not mean that order information is anonymous or that no records are kept.",
        ],
      },
      {
        heading: "Information you provide",
        withoutLocations: {
          bullets: {
            0: "Orders: your name, email address and phone number; delivery address and instructions; items, customizations, quantities, discounts and reward choices.",
          },
        },
        bullets: [
          "Orders: your name, email address and phone number; delivery address and instructions when applicable; selected store, items, customizations, quantities, discounts and reward choices.",
          "Catering: your name, email, phone, event date, guest count, chosen package and message. Sending an inquiry does not book an event.",
          "Support: contact details, the topic and message you send, and any order or payment reference you choose to include. Include only information needed to explain the issue.",
          "Gallery: the display name and comment text you submit. These are public, together with the posting date. Use a name you are comfortable displaying and keep private order, contact and payment details out of comments.",
        ],
      },
      {
        heading: "Browser, payment and technical information",
        paragraphs: [
          "A browser identifier connects this device with its cart, points, order history and gallery interactions. Cart choices, saved contact details and a delivery address can be stored in your browser as well as in relevant order or business records. A temporary checkout reference helps the site handle retries. See the Cookies and browser storage notice for controls and shared-device precautions.",
          "When hosted checkout starts, an order record and its contact details may be saved before payment completes. The site retains payment references, transaction identifiers, amount, currency, status and payment method; it may also retain the last four digits supplied by the payment provider. The normal hosted payment flow does not ask you to enter a full card number or card security code into Grill & Swill forms.",
          "Running the site can also involve technical information such as requests, browser or device details, errors and diagnostic logs. Error reports may include a page route and technical error details. The precise information available to hosting or embedded-service providers depends on their services and your browser.",
          "Support submission controls use counters with short active windows associated with contact details and, when available from trusted hosting information, network addresses. These help limit repeated automated submissions. Expired windows stop counting towards a limit; the counter records and support cases are not automatically deleted on that schedule.",
        ],
      },
      {
        heading: "Why information is used",
        withoutLocations: {
          bullets: {
            1: "To retain the cart, display device-linked history, and calculate or review rewards and promotions.",
          },
        },
        bullets: [
          "To prepare, price, process and fulfill orders, display tracking and receipts, and review payment issues.",
          "To retain the cart and chosen store, display device-linked history, and calculate or review rewards and promotions.",
          "To review catering inquiries, support cases, complaints, accessibility requests and privacy requests, and respond using the contact channel available for the case.",
          "To display gallery comments and like counts, manage public content, maintain service operation and investigate errors or misuse.",
          "To keep relevant business, transaction and operational records. A support submission does not by itself subscribe you to a marketing list.",
        ],
      },
      {
        heading: "Payments and other service providers",
        withoutLocations: {
          paragraphs: {
            1: "Hosting and database services support running the website and storing its records. Google Fonts supplies typefaces. Gallery images or videos may load from an external host selected for that content. Loading these services can send ordinary network, device and request information to the provider. Each provider has its own privacy practices and may operate in a different country from you.",
          },
        },
        paragraphs: [
          "Flutterwave provides the hosted payment page. Grill & Swill sends it the customer name, email and phone number, order and transaction references, payment amount and currency, and limited order information needed for checkout. Payment details entered on that page are handled by Flutterwave under its own terms and privacy information. We receive payment information needed to match the transaction to the order and display its result.",
          "Hosting and database services support running the website and storing its records. Google Fonts supplies typefaces. The locations page offers an OpenStreetMap map that loads when you choose to load it; you can read the store details without loading the map. Gallery images or videos may load from an external host selected for that content. Loading these services can send ordinary network, device and request information to the provider. Each provider has its own privacy practices and may operate in a different location from you.",
          "Where support email delivery is configured, the relevant contact details, case reference and message or staff reply may be passed to an email delivery provider to reach the team or the customer. Recording a case does not by itself mean an email was sent, delivered or answered. Support communications are for handling the request; submitting a case does not subscribe you to marketing.",
          "Where Lovable runtime reporting is enabled, its tools can receive technical error reports to help investigate website problems. Some reporting is specific to editor previews. The storefront does not currently include an optional advertising or marketing-analytics programme; payment, hosting and embedded providers can still receive technical information.",
        ],
      },
      {
        heading: "Public comments and private order links",
        paragraphs: [
          "Gallery comments are intended for public display. Other people may view or copy them. Do not use comments to share an address, phone number, payment receipt, private tracking link or medical information. Ask Support if you need help with information you have posted.",
          "Order tracking and receipt links can reveal names, order details and delivery information. Keep those links private and share them only with someone you intend to let view the order. Someone using the same browser may also be able to reopen saved details or device-linked history.",
        ],
      },
      {
        heading: "Retention and your choices",
        paragraphs: [
          "Customer records are not all removed automatically after a fixed period. Browser data may remain until it is removed by you or your browser; business records can remain separately. Clearing cookies or site storage does not delete server-held orders, payment records, catering inquiries, comments or support cases.",
          "Use Support to ask about access, correction, removal or another privacy concern. Tell us the type of record involved and, if relevant, an order or case reference. We may need enough information to confirm that the request relates to you before discussing private records. Do not send passwords, full card details or a private tracking token as identity evidence.",
          "What can be provided or removed depends on the request, applicable rights, records needed for ongoing orders or disputes, and relevant recordkeeping obligations. A request is reviewed; it is not an instant self-service deletion. Ask for an explanation or further review if the response does not resolve your concern.",
        ],
      },
      {
        heading: "Children, changes and questions",
        paragraphs: [
          "A parent or guardian should help a child use ordering or contact features and avoid unnecessary personal information in a child's message. If you believe a child has submitted information that needs attention, use Support so the circumstances can be reviewed.",
          "The date on this page identifies this version of the notice. Information about how the service operates may be updated when features or providers change. Use Support for questions about this notice, information handling or a previous request.",
        ],
      },
    ],
  },
  {
    slug: "terms",
    title: "Terms of use and ordering",
    description:
      "Practical terms for guest orders, payments, promotions, rewards, catering and public comments.",
    sections: [
      {
        heading: "Using Grill & Swill",
        withoutLocations: {
          paragraphs: {
            0: "These terms explain how to use the Grill & Swill website and its ordering features. Read them with the Privacy notice, Cancellation and refund requests, Delivery information, and Food and allergen information. Support is the contact route for questions or complaints about using the service.",
            1: "Grill & Swill welcomes customers and website visitors from around the world. Food orders depend on availability and the options accepted at checkout. Access to the website does not establish food-delivery availability at every address.",
          },
        },
        paragraphs: [
          "These terms explain how to use the Grill & Swill website and its ordering features. Read them with the Privacy notice, Cancellation and refund requests, Delivery and pickup information, and Food and allergen information. Support is the contact route for questions or complaints about using the service.",
          "Grill & Swill welcomes customers and website visitors from around the world. Food orders depend on the selected store, its available services and the options accepted at checkout. Access to the website does not establish food-delivery availability at every address.",
          "Place orders only when you are able to make the purchase and authorised to use the payment method. A parent or guardian should assist a child with purchasing. Keep the contact details supplied for an order accurate so a problem can be discussed with the person who placed it.",
        ],
      },
      {
        heading: "Review your order before paying",
        withoutLocations: {
          paragraphs: {
            0: "Check the items, quantities, customizations, recipient and delivery details, and total before continuing to payment. Different options can change the price. Removing an ingredient or adding a note is not confirmation that an allergy or special preparation request can be accommodated.",
          },
        },
        paragraphs: [
          "Check the selected store, pickup or delivery choice, items, quantities, customizations, recipient details and total before continuing to payment. Different options can change the price. Removing an ingredient or adding a note is not confirmation that an allergy or special preparation request can be accommodated.",
          "Menu items, descriptions, availability and prices can change. Photographs illustrate the food and may not show your exact customization or portion. Checkout reviews the current order information. If availability or the total changes, review it before deciding whether to continue.",
        ],
      },
      {
        heading: "Prices, fees and payments",
        paragraphs: [
          "The current online menu and checkout use USD. Review the checkout breakdown for item and customization charges, applicable discounts, delivery fees and tax. Do not rely on an old cart, screenshot or previous promotion as the price for a new order. Your bank or payment provider may apply its own currency conversion or charges.",
          "Online payment is made through Flutterwave's hosted checkout. Its available methods and payment rules apply to that step. An order reference or printable receipt can exist while payment is pending; check the payment status rather than treating a reference alone as proof of payment.",
          "Payment confirmation and preparation or delivery are separate parts of the order. If your payment provider shows a charge but the site does not confirm payment, do not keep submitting payments. Use Support with the order or transaction reference so the records can be reviewed.",
        ],
      },
      {
        heading: "Changes, cancellations and order problems",
        paragraphs: [
          "Use Support promptly if you need to change contact details, fulfillment information or an item, or ask to cancel. Include the order number and the requested change. A message is a request; do not assume a change has been made until it is confirmed. Preparation or handoff may limit what can be changed.",
          "The website does not offer an automatic customer cancellation or payment-refund button. Leaving checkout, closing a tab, cancelling a payment attempt or changing an order status does not by itself reverse a settled payment. The Cancellation and refund requests page explains how to report a problem and request review.",
        ],
      },
      {
        heading: "Promotions and device-based rewards",
        paragraphs: [
          "Promotions can have eligibility, minimum-spend, product, date or usage conditions. Use the current description and checkout result to check whether a code applies. Discounts and points can affect the amount eligible for other benefits; the checkout summary shows what is applied to that order.",
          "Rewards and history are linked to the browser used for guest ordering. They are not a cash account or a guaranteed transfer between devices. Follow the current rewards page and checkout rates; do not assume a rate or offer is permanent. Report an unexpected balance or a payment-related points issue through Support for review.",
          "Clearing browser data, using private browsing, changing devices or losing access to a browser can interrupt access to rewards and order history. Keep your receipts. Support can review an access problem using available records, but recovery or transfer is not guaranteed.",
        ],
      },
      {
        heading: "Catering inquiries",
        withoutLocations: {
          paragraphs: {
            0: "Catering pages let you review packages and send event details. Submitting an inquiry is not a confirmed booking, accepted quote or payment. Timing, availability, portions, special requirements, delivery arrangements and any separate payment terms need confirmation from the team.",
          },
        },
        paragraphs: [
          "Catering pages let you review packages and send event details. Submitting an inquiry is not a confirmed booking, accepted quote or payment. Timing, availability, portions, special requirements, collection or delivery arrangements and any separate payment terms need confirmation from the team.",
          "Use the catering form for a new event inquiry and Support for questions about an existing inquiry. Do not treat a successful form submission as a reserved slot or assume that the online package price covers arrangements that have not been agreed.",
        ],
      },
      {
        heading: "Gallery comments and responsible use",
        paragraphs: [
          "Submit only content you are entitled to share. Keep comments relevant and respectful. Do not post private information about another person, abusive or unlawful material, spam, misleading claims or private order links. Your chosen display name and comment are public.",
          "You remain responsible for content you submit. By posting a comment, you allow it to be stored and displayed as part of the gallery. Content can be reviewed, restricted or removed as part of operating the site; publication does not mean that the team endorses every statement. Use Support to report inappropriate content or ask about your own post.",
          "Do not interfere with the site, attempt to access another person's private records, or misuse ordering, payment or contact features. Keep order links and saved device information under your control.",
        ],
      },
      {
        heading: "Availability, outside services and your rights",
        withoutLocations: {
          paragraphs: {
            0: "Website information or features may be unavailable or delayed during errors, maintenance or external-service problems. Payment pages and external media operate through their providers. Use Support if a problem prevents you from finishing a task; avoid repeating a payment while its outcome is unclear.",
          },
        },
        paragraphs: [
          "Website information or features may be unavailable or delayed during errors, maintenance or external-service problems. Payment pages, maps and external media operate through their providers. Use Support if a problem prevents you from finishing a task; avoid repeating a payment while its outcome is unclear.",
          "These pages do not remove consumer or privacy rights that cannot be excluded under applicable law. If you believe an order, payment or response has not been handled correctly, describe the concern through Support and ask for further review. Keep the relevant order, payment and support references.",
          "The date on this page identifies this version. Current ordering terms should be read before a new purchase. A later website update does not by itself undo a completed order or remove applicable rights.",
        ],
      },
    ],
  },
  {
    slug: "refund-policy",
    title: "Cancellation and refund requests",
    description:
      "How to request an order change, cancellation or review of a charge, missing item or food-quality problem.",
    sections: [
      {
        heading: "Start with the order reference",
        withoutLocations: {
          paragraphs: {
            0: "Use Support as soon as you notice a problem. Choose the closest topic and include the order number or receipt reference, the date and a clear description of what happened. Do not assume that a submitted message immediately stops preparation or delivery.",
          },
        },
        paragraphs: [
          "Use Support as soon as you notice a problem. Choose the closest topic and include the order number or receipt reference, the date, the selected store and a clear description of what happened. For a time-sensitive order issue, you can also use a store contact you have already confirmed. Do not assume that a submitted message immediately stops preparation or delivery.",
          "The team reviews the circumstances and available order or payment records before confirming a change or remedy. This page describes a request process; it does not promise a refund for every cancellation or set a universal refund deadline.",
        ],
      },
      {
        heading: "Changes and cancellations",
        withoutLocations: {
          paragraphs: {
            0: "If you need to cancel or change an item, delivery address or contact detail, explain exactly what you want changed. Preparation, packaging or handoff can affect what is still possible. Wait for confirmation rather than assuming your request has been accepted.",
          },
        },
        paragraphs: [
          "If you need to cancel or change an item, address, contact detail or pickup arrangement, explain exactly what you want changed. Preparation, packaging or handoff can affect what is still possible. Wait for confirmation rather than assuming your request has been accepted.",
          "Closing a browser tab or leaving the hosted payment page is not the same as cancelling an order. Cancelling a payment attempt is also different from reversing a payment that has already settled. If the site shows an order as cancelled but your provider shows a charge, ask Support to review both records.",
        ],
      },
      {
        heading: "Missing, incorrect, late or damaged orders",
        paragraphs: [
          "Tell Support which item or part of the order was affected, what you received and when you noticed the issue. Include relevant order details without posting them in the public gallery. An order number and a brief factual explanation are usually the best starting point; the team can ask for further information if it is needed.",
          "A proposed resolution depends on the circumstances and applicable rights. The team should explain what action is being offered and confirm any agreed replacement, correction or refund separately. This website does not automatically issue a refund when a complaint is submitted.",
        ],
      },
      {
        heading: "Food safety or allergy concerns",
        paragraphs: [
          "If food appears unsafe or you think it has caused an allergic reaction, stop eating it. Seek appropriate medical help for symptoms; in an emergency contact local emergency services. A website support request is not an emergency or medical-response service.",
          "When it is safe to do so, report the affected order and item through Support and make the food concern clear. Avoid sending medical records or other sensitive health information in the initial message. Food and allergen information explains why an ingredient note is not confirmation of a safe preparation arrangement.",
        ],
      },
      {
        heading: "Charged but pending, failed or charged more than once",
        paragraphs: [
          "If Flutterwave or your bank shows a charge while the website shows pending, failed or unconfirmed payment, do not pay again immediately. Keep the transaction reference, amount, date and any provider confirmation. Send the order and transaction references to Support so the charge can be matched to the correct order.",
          "For a possible duplicate charge, explain the number of charges and their references. A pending authorisation, completed charge and completed refund are different payment states. The bank or payment provider can also clarify the status on its side. Never send a full card number, security code, banking password or one-time code.",
        ],
      },
      {
        heading: "If a refund or other remedy is agreed",
        paragraphs: [
          "The website records support requests; it does not run an automatic payment-refund workflow. An order cancellation or support case status is not confirmation that Flutterwave or your bank has processed a refund.",
          "Approved payment refunds are normally returned to the original payment method where the payment provider supports it. Ask for confirmation of the amount, the payment it relates to and the provider reference where available. If that method cannot be used, the team needs to confirm an appropriate arrangement with the customer rather than treating a different recipient or payment method as automatic.",
          "Posting time can depend on the provider and bank; no fixed processing time is promised here. Ask the team to clarify how any fees, discounts or redeemed and earned points are being treated rather than assuming they are restored automatically.",
          "If an explanation or proposed remedy does not resolve the issue, ask for further review through Support and quote the existing case reference. These instructions do not limit rights that apply to your purchase under law.",
        ],
      },
    ],
  },
  {
    slug: "delivery-policy",
    withoutLocations: {
      title: "Delivery information",
      description: "Providing delivery details and getting help with your order.",
    },
    title: "Delivery and pickup information",
    description:
      "Choosing the right store, providing delivery details, collecting an order and getting help with fulfillment.",
    sections: [
      {
        heading: "Choose the store and fulfillment method",
        withoutLocations: {
          heading: "Before placing your order",
          paragraphs: {
            0: "Review the delivery options and current information shown at checkout before paying. The website does not promise a universal delivery area or a fixed arrival time.",
            1: "Visitors can use the website from around the world, but food delivery depends on checkout availability. Check the options for your address; the site does not offer a worldwide food-shipping promise.",
            2: "If your requested delivery arrangement is uncertain, ask Support before placing the order. Changes after submission require review; a message alone does not alter an order.",
          },
        },
        paragraphs: [
          "Select the store and choose delivery or pickup before paying. Check the selected location and current information shown for it. Availability, operating hours and arrangements can differ between stores; the website does not promise a universal delivery area or a fixed arrival time.",
          "Visitors can use the website from around the world, but food pickup and delivery depend on the local store and checkout availability. Check the options for the address and location involved; the site does not offer a worldwide food-shipping promise.",
          "If your location or requested arrangement is uncertain, ask Support before placing the order. Changing the selected store or fulfillment method after submission requires review; a message alone does not move an order to another location.",
        ],
      },
      {
        heading: "Delivery details",
        paragraphs: [
          "Provide the recipient's name, reachable phone number and complete delivery address, including a unit or access information when needed. Review the address before payment. Use delivery instructions for practical access details and avoid unnecessary private information.",
          "Review any delivery charge in the checkout total. A promotion or delivery threshold can change, so use the current checkout breakdown. There is no universal promise here about unattended drop-off, a particular courier, delivery distance or compensation for a specified delay.",
        ],
      },
      {
        heading: "Pickup details",
        withoutLocations: null,
        paragraphs: [
          "Use the chosen store and the pickup name supplied with the order. Keep the order number or receipt available to help the team identify it. If someone else is collecting, make sure they have the order information you intend to share and confirm any arrangement that needs staff approval.",
          "Check order progress rather than assuming food is ready as soon as payment succeeds. Ask Support if you cannot collect, chose the wrong store or need help finding the relevant order. A refund or change for an uncollected order is reviewed; it is not automatic.",
        ],
      },
      {
        heading: "Understanding order progress",
        withoutLocations: {
          bullets: {
            2: "Out for delivery: the order is at the handoff stage.",
            3: "Delivered: the recorded order is marked completed. If this does not match what happened, report the discrepancy with the order reference.",
          },
        },
        bullets: [
          "Order received: the order record has been received. Check its separate payment status if payment is uncertain.",
          "Fired to kitchen: preparation is in progress according to the recorded order status.",
          "Ready for pickup or out for delivery: the handoff stage is shown according to the chosen fulfillment method.",
          "Picked up or delivered: the recorded order is marked completed. If this does not match what happened, report the discrepancy with the order reference.",
        ],
      },
      {
        heading: "Late, missing or incorrect fulfillment",
        withoutLocations: {
          paragraphs: {
            0: "Use Support if an order is late, missing, delivered to the wrong place or marked completed unexpectedly. Include the order number and relevant contact or address correction.",
          },
        },
        paragraphs: [
          "Use Support if an order is late, missing, delivered to the wrong place or marked completed unexpectedly. Include the order number, fulfillment method and relevant contact or address correction. For a time-sensitive issue, contact a store directly if you already have a confirmed contact for it.",
          "Keep your tracking and receipt links private; they can contain contact or address details. The Cancellation and refund requests page explains how to ask for a remedy. A support submission does not automatically alter the delivery route or refund the payment.",
        ],
      },
      {
        heading: "Food and catering",
        withoutLocations: {
          paragraphs: {
            1: "Catering uses a separate inquiry process. Event timing, guest count, portions, payment, delivery and any other arrangements need confirmation from the team; a catering form submission does not create a booked delivery slot.",
          },
        },
        paragraphs: [
          "Check Food and allergen information before ordering if an ingredient or preparation arrangement matters to you. An order note alone is not confirmation that an allergy request can be accommodated.",
          "Catering uses a separate inquiry process. Event timing, guest count, portions, payment, delivery or collection and any other arrangements need confirmation from the team; a catering form submission does not create a booked delivery or pickup slot.",
        ],
      },
    ],
  },
  {
    slug: "allergens",
    title: "Food and allergen information",
    description:
      "Ingredient and customization guidance, allergy precautions and what to do if a food concern arises.",
    sections: [
      {
        heading: "Ask before ordering when safety matters",
        paragraphs: [
          "If you have a food allergy, intolerance or another preparation requirement, ask the team for current ingredient and preparation information before paying. Explain the specific ingredient or requirement and wait for confirmation of what can be accommodated. The site does not provide a verified allergen matrix for every item and customization.",
          "Do not assume that a menu tag, ingredient list, image or removed topping proves an item is safe for you. If the team cannot confirm a suitable arrangement, do not rely on an order note as a substitute for that confirmation.",
        ],
      },
      {
        heading: "Ingredients and cross-contact",
        withoutLocations: {
          paragraphs: {
            1: "The website does not guarantee allergen-free preparation or the absence of cross-contact. Removing an ingredient from an order does not necessarily remove exposure from preparation or other ingredients. Ask staff about the actual arrangement for your selected item.",
          },
        },
        paragraphs: [
          "Menu foods can contain ingredients associated with allergies, including ingredients in bread, sauces, cheese, toppings, drinks and desserts. Recipes, suppliers and available options can change. A short menu description is not a complete ingredient or allergen statement.",
          "The website does not guarantee allergen-free preparation or the absence of cross-contact. Removing an ingredient from an order does not necessarily remove exposure from preparation or other ingredients. Ask staff about the actual arrangement for the selected item and location.",
        ],
      },
      {
        heading: "Customizations, dietary tags and nutrition",
        paragraphs: [
          "Available customizations let you request the options shown for an item. Check the final summary before paying. A request to remove a topping, change crust or select a dietary tag is not a medical or food-safety assurance.",
          "Photographs, descriptions and any calorie information describe the menu offering and can differ with portion or customization. The site does not claim certified dietary status or provide personalised nutrition advice. Ask about details you need rather than inferring them from a name or picture.",
        ],
      },
      {
        heading: "Catering and group orders",
        paragraphs: [
          "Tell the catering team about relevant ingredient requirements during the inquiry and confirm arrangements before the event or payment. Include enough information to explain the preparation need without sending unnecessary medical details about guests.",
          "A catering inquiry, package selection or message is not confirmation that every dietary requirement can be met. Confirm what is being prepared and how guests can identify the appropriate food.",
        ],
      },
      {
        heading: "If food seems unsafe or a reaction occurs",
        paragraphs: [
          "Stop eating food that appears unsafe or is associated with a suspected reaction. Seek medical help for symptoms; if there is immediate danger, contact local emergency services. The support form is not an emergency service and cannot provide medical assistance.",
          "When it is safe, report the order number, affected item and concern through Support. Keep the initial message factual and avoid attaching or sharing medical records or payment credentials. See Cancellation and refund requests for how an order issue is reviewed.",
        ],
      },
    ],
  },
  {
    slug: "cookies",
    title: "Cookies and browser storage",
    description:
      "What the site remembers in your browser, why it is used and what happens when you remove it.",
    sections: [
      {
        heading: "More than cookies",
        paragraphs: [
          "The site uses browser storage as well as cookies. Local storage can remain between visits; session storage is temporary to a browser session or tab. These are used for guest ordering and convenience features. They are not the same as a registered customer account.",
          "The storefront does not currently include an optional advertising or marketing-analytics cookie programme or a cookie preference centre. Core browser storage is used by the current ordering features. Payment providers, hosting and embedded services can have their own practices, described in their notices.",
        ],
      },
      {
        heading: "What is remembered",
        withoutLocations: {
          bullets: {
            1: "Cart and preferences: selected items, customizations and quantities can be kept for a later visit and synchronized with the site's records.",
          },
        },
        bullets: [
          "Guest identifier: connects this browser with its cart, device-linked rewards and history, and gallery interactions.",
          "Cart and preferences: selected items, customizations, quantities, fulfillment method and store choice can be kept for a later visit and synchronized with the site's records.",
          "Checkout contact and address: a supplied email, phone number and delivery address can be saved to help fill a future checkout. This can include a recipient name and access instructions.",
          "Checkout retry reference: a temporary reference helps the site recognise a continued or repeated submission. It is cleared by some payment-return flows or by the browser's session controls.",
          "Operator session cookies: staff and administrator areas use cookies for their sign-in session. These are distinct from guest history and are not a customer account login.",
          "External map preference: remembers whether you allowed or blocked external maps, so your choice can apply on a later visit.",
        ],
      },
      {
        heading: "External content and services",
        withoutLocations: {
          paragraphs: {
            0: "Fonts are loaded from Google Fonts, and gallery media may load from an external host. Flutterwave's payment page operates outside the storefront. Loading external services can disclose ordinary connection and request information to them; their own cookie or storage practices may apply.",
          },
        },
        paragraphs: [
          "Fonts are loaded from Google Fonts, and gallery media may load from an external host. The locations page leaves its OpenStreetMap map unloaded until you choose to load it, so you can use the written store information without contacting the map provider. Flutterwave's payment page operates outside the storefront. Loading external services can disclose ordinary connection and request information to them; their own cookie or storage practices may apply.",
          "Technical error reporting can also be enabled through the hosting or Lovable environment. The Privacy notice explains these categories. This page does not claim that third-party content sets no cookies or that browser settings control information already held by a provider.",
          "You can disable future external map loads using the control below. A saved allow choice can load a map on a later visit. Disabling or clearing the preference cannot undo information already sent to the map provider.",
        ],
      },
      {
        heading: "Shared devices and duration",
        paragraphs: [
          "Saved contact and address details are accessible to someone using the same browser. Private tracking or receipt links can also expose order details to the person opening them. Take care on a shared or public device and remove saved site data when appropriate.",
          "Guest, cart and saved checkout data do not have one universal automatic expiry set by the site. They can remain until cleared, replaced or removed by browser settings. Session storage is shorter-lived, and operator cookies have their own session expiry. Browser removal does not erase server-held business records.",
        ],
      },
      {
        heading: "Your browser controls",
        paragraphs: [
          "Your browser's site-data settings can clear stored information or restrict cookies and storage. Removing the cart through the site removes its current items; it is not the same as clearing all saved contact information or deleting the business's order records.",
          "The site's device-data control removes the saved Grill & Swill identifier, cart, checkout contact and address details, external map preference, and temporary checkout reference from this browser. It does not clear unrelated browser storage, cancel an order, reverse a payment or erase server-held records. Clearing the identifier can make earlier history and rewards unavailable on this device.",
          "Blocking or clearing storage can prevent guest features from working or make your history and points unavailable on that browser. Private browsing or a new browser can create a separate guest history. Save relevant receipts before clearing data, and use Support if you need help reviewing a lost-access or privacy issue. Recovery is not guaranteed.",
        ],
      },
    ],
  },
  {
    slug: "accessibility",
    title: "Accessibility statement",
    description:
      "Our accessibility aim, website features, possible limitations and how to request help or report a barrier.",
    sections: [
      {
        heading: "Our aim",
        paragraphs: [
          "Grill & Swill aims to make browsing, ordering and getting help usable by people with different access needs. WCAG 2.2 Level AA is the website's design and development target. This statement is not a certification that every page or external service fully conforms.",
          "Accessibility is an ongoing part of reviewing the site. Use Support to report a barrier or ask for help completing a task in another way.",
        ],
      },
      {
        heading: "Features intended to help",
        bullets: [
          "A skip link, headings and page structure help people navigate content.",
          "Forms and controls are intended to provide labels, focus visibility, error feedback and keyboard operation.",
          "Responsive layouts aim to support smaller screens and text resizing; order status uses written labels as well as visual cues.",
          "Motion features are designed to respect reduced-motion settings, and essential content should be readable without depending on an animation.",
        ],
      },
      {
        heading: "Possible limitations",
        withoutLocations: {
          paragraphs: {
            0: "Some combinations of browser, device or assistive technology may still present difficulties. Dynamic controls, customizations, images or videos can require additional review. The external hosted payment page and other embedded services have their own accessibility behaviour.",
          },
        },
        paragraphs: [
          "Some combinations of browser, device or assistive technology may still present difficulties. Dynamic controls, customizations, maps, images or videos can require additional review. The external hosted payment page and other embedded services have their own accessibility behaviour.",
          "If an error or inaccessible control prevents an order, do not keep repeating payment attempts. Explain the task through Support so an appropriate alternative can be discussed. A support message does not itself place an order or complete payment.",
        ],
      },
      {
        heading: "Report a barrier or ask for an alternative",
        paragraphs: [
          "Choose an accessibility or general-help topic in Support. Tell us which page or task caused the difficulty, what you were trying to do and, if useful, your browser, device or assistive technology. Describe the help or alternative format you need; you do not need to provide a diagnosis or medical records.",
          "Keep any case reference so you can follow up or ask for further review if the response does not resolve the problem. No fixed response deadline is promised in this statement. For immediate medical danger, contact local emergency services rather than using the website form.",
        ],
      },
      {
        heading: "Updates",
        paragraphs: [
          "The date shown on this page identifies this version of the statement. Accessibility features and known issues may change as the website is reviewed. Feedback through Support helps identify tasks that need attention.",
        ],
      },
    ],
  },
] as const satisfies readonly CustomerPolicyPage[];

export type CustomerFaqGroup = {
  title: string;
  items: readonly {
    question: string;
    answer: readonly string[];
    withoutLocations?: { question?: string; answer: readonly string[] };
  }[];
};

export const FAQ_GROUPS = [
  {
    title: "Ordering and the menu",
    items: [
      {
        question: "Do I need to create an account?",
        answer: [
          "No customer signup is required. Guest ordering uses this browser to connect your cart, history and rewards. Keep your order receipt, and remember that a new device or cleared browser storage may not have the same history.",
        ],
      },
      {
        question: "How do I choose pickup or delivery?",
        withoutLocations: {
          question: "How do I arrange delivery?",
          answer: [
            "Provide a complete delivery address and reachable contact details at checkout, then review them before paying. Ask Support before ordering if a delivery arrangement is unclear.",
          ],
        },
        answer: [
          "Choose the fulfillment method and store in your bag or checkout, then review them before paying. For delivery, provide a complete address and reachable contact details. Ask Support before ordering if the available location or arrangement is unclear.",
        ],
      },
      {
        question: "Can I customise an item or order a combo?",
        answer: [
          "Use the choices shown for the item and check the resulting bag summary. Some options change the price or depend on current availability. An order note or removed topping is not confirmation that an allergy request can be accommodated.",
        ],
      },
      {
        question: "Why did a price or item change at checkout?",
        answer: [
          "Checkout reviews current menu prices, options and availability. A saved cart or previous order can differ from the current menu. Review any updated total or unavailable item before continuing to payment.",
        ],
      },
      {
        question: "Where can I check allergens or dietary information?",
        answer: [
          "Read Food and allergen information and ask the team for current ingredients and preparation details before paying. The site does not provide a verified allergen matrix or guarantee allergen-free preparation. Wait for confirmation; a dietary tag, image or note alone is not a safety assurance.",
        ],
      },
    ],
  },
  {
    title: "Payments and receipts",
    items: [
      {
        question: "Where do I pay, and which currency is used?",
        answer: [
          "The current online checkout uses USD and takes you to Flutterwave's hosted payment page. Review the item, discount, delivery and tax breakdown before paying. Your bank or provider may apply its own conversion or charges.",
        ],
      },
      {
        question: "I was charged, but the site says pending or payment failed. What should I do?",
        answer: [
          "Do not pay again immediately. Keep the order number, transaction reference, amount and date, and use Support to request a payment review. A bank authorisation and a completed charge can have different statuses; the provider or bank can also clarify its record.",
        ],
      },
      {
        question: "What if I think I paid twice?",
        answer: [
          "Send Support the relevant order and transaction references and explain the charges you can see. Avoid submitting another payment while the result is uncertain. Never include a full card number, card security code, banking password or one-time code.",
        ],
      },
      {
        question: "Is an order number or receipt proof that I paid?",
        answer: [
          "Not on its own. A record or printable receipt can exist while payment is pending. Check the separate payment status. If the displayed result conflicts with a provider confirmation, ask Support to review the references.",
        ],
      },
      {
        question: "How can I reopen or print a receipt?",
        answer: [
          "Open order history on the browser used for the order, choose the relevant order and open its receipt. The receipt page offers printing. Keep its link private because it can show order, contact and delivery details.",
        ],
      },
      {
        question: "Does the site store my full card details?",
        answer: [
          "The normal checkout sends you to Flutterwave to enter payment details. Grill & Swill keeps payment information needed for the order, such as references, status, method and optional last four digits; it does not ask for full card details or a security code in its order or support forms.",
        ],
      },
    ],
  },
  {
    title: "Order progress, changes and refunds",
    items: [
      {
        question: "How do I track an order?",
        answer: [
          "Open the private tracking link or choose the order from this browser's history. It shows the recorded preparation and handoff stage, separately from payment status. A displayed stage is not a guaranteed arrival time; ask Support if it does not match what happened.",
        ],
      },
      {
        question: "Can I change or cancel after submitting?",
        answer: [
          "Use Support promptly with the order number and the exact requested change. Preparation or handoff may limit what is possible. There is no automatic customer cancellation button, and submitting a message is not confirmation that the order has changed.",
        ],
      },
      {
        question: "Does closing checkout cancel the order or refund me?",
        answer: [
          "No. Leaving the payment page, cancelling a payment attempt, changing an order's status and reversing a settled charge are different actions. If a charge exists, use Support for review rather than assuming it was returned.",
        ],
      },
      {
        question:
          "My order is late, missing, wrong or marked delivered unexpectedly. How do I complain?",
        withoutLocations: {
          answer: [
            "Choose an order or delivery issue in Support and include the order number, date and a brief description of the affected item or delivery. Keep your private order details out of gallery comments.",
          ],
        },
        answer: [
          "Choose an order or delivery issue in Support and include the order number, store, date and a brief description of the affected item or fulfillment. Keep your private order details out of gallery comments. If you already have a confirmed store contact, use it for a time-sensitive issue as well.",
        ],
      },
      {
        question: "How do refunds work?",
        answer: [
          "Read Cancellation and refund requests, then send Support the order or payment references and the reason for review. The site records the case but does not automatically refund payments. Approved refunds normally return to the original payment method where supported. Ask for confirmation of the amount and treatment of fees, discounts and points. Provider or bank posting times can vary; no universal deadline is promised here.",
        ],
      },
      {
        question: "What if the food seems unsafe or I have a reaction?",
        answer: [
          "Stop eating the affected food. Seek medical help for symptoms and contact local emergency services if there is immediate danger. Support is not an emergency or medical-response service. When safe, report the order and item through Support without sending unnecessary medical records.",
        ],
      },
      {
        question: "How can I ask for further review of a complaint?",
        answer: [
          "Follow up through Support with the existing case reference, explain what remains unresolved and ask for further review. Keep the order and payment references connected to the case. Do not post private evidence in public comments.",
        ],
      },
    ],
  },
  {
    title: "Rewards, promotions and browser history",
    items: [
      {
        question: "Where are my points and order history kept?",
        answer: [
          "They are linked to the browser identifier used for guest ordering, with relevant records kept by the site. Check the current rewards page and checkout for rates and eligible redemption. This is not a conventional registered account that automatically follows you to another device.",
        ],
      },
      {
        question: "I changed devices or cleared site data. Can my history or points be recovered?",
        answer: [
          "A new or cleared browser may no longer have the identifier connected to earlier history. Keep your receipts and ask Support to review the access problem using available order information. Recovery or transfer is not guaranteed, so avoid clearing a browser you still need for history without first saving relevant receipts.",
        ],
      },
      {
        question: "Why did a promo code or points redemption not apply?",
        answer: [
          "A code or redemption can depend on the current promotion, product, spend, availability or points balance. Review the description and the final checkout result. If it still seems wrong, ask Support about the specific order or code without assuming an expired or previous offer remains valid.",
        ],
      },
      {
        question: "Will a cancellation or refund automatically restore my points?",
        answer: [
          "Do not assume so. Ask Support to review the payment, redeemed points and earned points together and explain any agreed adjustment. An order cancellation or support case status is not itself a completed refund or points-restoration confirmation.",
        ],
      },
    ],
  },
  {
    title: "Catering and gallery",
    items: [
      {
        question: "Does sending a catering form book my event?",
        withoutLocations: {
          answer: [
            "No. It records an inquiry for staff review. The team needs to confirm timing, availability, portions, special requirements, delivery, and any separate payment terms. A form confirmation is not an accepted quotation, reserved slot or payment.",
          ],
        },
        answer: [
          "No. It records an inquiry for staff review. The team needs to confirm timing, availability, portions, special requirements, pickup or delivery, and any separate payment terms. A form confirmation is not an accepted quotation, reserved slot or payment.",
        ],
      },
      {
        question: "What information should I include for catering?",
        answer: [
          "Use the catering page for the event date, guest count, package interest and contact details. Explain preparation or dietary needs that matter, then wait for confirmation of what is possible. Avoid unnecessary medical information about guests. Use Support for an existing inquiry or a follow-up issue.",
        ],
      },
      {
        question: "Are my gallery comments private?",
        answer: [
          "No. Your chosen display name, comment and posting date are public. Keep contact details, delivery addresses, payment evidence and tracking links out of comments. Likes are linked to a browser identifier; a public like count is not a customer review or rating.",
        ],
      },
      {
        question: "How do I report a comment or ask about a post?",
        answer: [
          "Use Support with enough information to identify the gallery post and explain the concern. Do not repeat another person's private information in a new public comment. A request can be reviewed without promising that all posts are checked before they appear.",
        ],
      },
    ],
  },
  {
    title: "Privacy, accessibility and support",
    items: [
      {
        question: "What does the site remember on my device?",
        answer: [
          "It can retain a guest identifier, cart and fulfillment choices, and saved checkout contact or delivery details. A checkout retry reference uses temporary session storage. Cookies and browser storage explains how to clear this information and the effect on guest features.",
        ],
      },
      {
        question: "Does clearing browser storage delete my data from the business?",
        answer: [
          "No. It removes browser-held information but does not erase server-held orders, payments, catering inquiries, comments or support cases. Use Support for a request about access, correction, removal or another privacy concern. The request may need checks and review before private records can be discussed or changed.",
        ],
      },
      {
        question: "What should I put in a support request?",
        answer: [
          "Choose the closest topic, provide a brief explanation and include the order or payment reference when relevant. Use an email you can access if a reply by email is needed. The form does not need attachments, full card details, passwords, private tracking tokens or medical records. Keep the case reference after submission.",
        ],
      },
      {
        question: "Does a support confirmation mean an email or refund has been sent?",
        answer: [
          "Not unless the confirmation explicitly says that action occurred. Recording a request is different from emailing it, receiving a staff response, cancelling an order or processing a refund. Keep the reference and follow up through the available support channel if the issue remains unresolved.",
        ],
      },
      {
        question: "I cannot use a page or control. How can I get help?",
        answer: [
          "Choose accessibility or general help in Support. Describe the page, task and barrier, and any browser or assistive-technology details that would help. Say what alternative you need; a diagnosis is unnecessary. The Accessibility statement explains the site's aim and possible external-service limitations.",
        ],
      },
      {
        question: "Is Support an emergency service?",
        withoutLocations: {
          answer: [
            "No. A website request is not an immediate medical-response channel and should not be used for an emergency. Contact local emergency services for immediate danger. For an active order issue, provide the order reference through Support.",
          ],
        },
        answer: [
          "No. A website request is not an immediate medical-response channel and should not be used for an emergency. Contact local emergency services for immediate danger. For an active order issue, provide the order reference and use a confirmed store contact if you already have one.",
        ],
      },
    ],
  },
] as const satisfies readonly CustomerFaqGroup[];

export function customerPolicyPage(slug: string, hasLocations: boolean): CustomerPolicyPage {
  const page: CustomerPolicyPage = PUBLIC_POLICY_PAGES.find((entry) => entry.slug === slug)!;
  if (hasLocations) return page;
  return {
    ...page,
    ...page.withoutLocations,
    sections: page.sections.flatMap((section) => {
      const alternate = section.withoutLocations;
      if (alternate === null) return [];
      return [
        {
          ...section,
          heading: alternate?.heading ?? section.heading,
          ...(section.paragraphs
            ? {
                paragraphs: section.paragraphs.map(
                  (text, index) => alternate?.paragraphs?.[index] ?? text,
                ),
              }
            : {}),
          ...(section.bullets
            ? {
                bullets: section.bullets.map((text, index) => alternate?.bullets?.[index] ?? text),
              }
            : {}),
        },
      ];
    }),
  };
}

export function customerFaqGroups(hasLocations: boolean): readonly CustomerFaqGroup[] {
  if (hasLocations) return FAQ_GROUPS;
  return (FAQ_GROUPS as readonly CustomerFaqGroup[]).map((group) => ({
    ...group,
    items: group.items.map((item) => ({ ...item, ...item.withoutLocations })),
  }));
}
