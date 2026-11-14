
create type public.app_role as enum ('admin', 'user');

-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  points integer not null default 0,
  lifetime_points integer not null default 0,
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "Users view own profile" on public.profiles for select to authenticated using (auth.uid() = id);

-- Only display_name is editable by the user
revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;
create policy "Users update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- ROLES
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "Users view own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.claim_first_admin()
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  if exists (select 1 from public.user_roles where role = 'admin') then
    return public.has_role(auth.uid(), 'admin');
  end if;
  insert into public.user_roles (user_id, role) values (auth.uid(), 'admin') on conflict do nothing;
  return true;
end;
$$;
revoke execute on function public.claim_first_admin() from anon, public;
grant execute on function public.claim_first_admin() to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- MENU
create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  category text not null check (category in ('burgers','chicken','pizza','sides','drinks')),
  name text not null,
  description text not null default '',
  price_cents integer not null check (price_cents >= 0),
  calories integer not null default 0,
  image_key text not null,
  tags text[] not null default '{}',
  ingredients text[] not null default '{}',
  options jsonb not null default '[]'::jsonb,
  is_available boolean not null default true,
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);
grant select on public.menu_items to anon, authenticated;
grant update on public.menu_items to authenticated;
grant all on public.menu_items to service_role;
alter table public.menu_items enable row level security;
create policy "Anyone can view menu" on public.menu_items for select to anon, authenticated using (true);
create policy "Admins update menu" on public.menu_items for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- STORES
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  city text not null,
  state text not null,
  zip text not null,
  phone text not null,
  lat double precision not null,
  lng double precision not null,
  hours text not null,
  features text[] not null default '{}',
  sort_order integer not null default 0
);
grant select on public.stores to anon, authenticated;
grant all on public.stores to service_role;
alter table public.stores enable row level security;
create policy "Anyone can view stores" on public.stores for select to anon, authenticated using (true);

-- ORDERS
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity (start with 1001),
  user_id uuid not null,
  status text not null default 'received' check (status in ('received','kitchen','handoff','completed','cancelled')),
  fulfillment text not null check (fulfillment in ('delivery','pickup')),
  store_id uuid references public.stores(id),
  address jsonb,
  items jsonb not null,
  subtotal_cents integer not null,
  discount_cents integer not null default 0,
  promo_code text,
  points_redeemed integer not null default 0,
  delivery_fee_cents integer not null default 0,
  tax_cents integer not null default 0,
  total_cents integer not null,
  points_earned integer not null default 0,
  payment_last4 text,
  customer_name text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_created_idx on public.orders (created_at desc);
grant select, update on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "Users view own orders" on public.orders for select to authenticated using (auth.uid() = user_id);
create policy "Admins view all orders" on public.orders for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Admins update orders" on public.orders for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();
create trigger menu_touch before update on public.menu_items for each row execute function public.touch_updated_at();

alter publication supabase_realtime add table public.orders;

-- ADMIN LOGS
create table public.admin_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select, insert on public.admin_logs to authenticated;
grant all on public.admin_logs to service_role;
alter table public.admin_logs enable row level security;
create policy "Admins view logs" on public.admin_logs for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Admins write logs" on public.admin_logs for insert to authenticated with check (public.has_role(auth.uid(), 'admin') and admin_id = auth.uid());

-- SEED STORES
insert into public.stores (name, address, city, state, zip, phone, lat, lng, hours, features, sort_order) values
('South Congress', '1412 S Congress Ave', 'Austin', 'TX', '78704', '(512) 555-0142', 30.2489, -97.7497, 'Daily 7am – 11pm', array['Drive-thru','Patio','Delivery'], 1),
('Deep Ellum', '2700 Elm St', 'Dallas', 'TX', '75226', '(214) 555-0187', 32.7838, -96.7826, 'Daily 7am – 12am', array['Late night','Delivery','Curbside'], 2),
('The Heights', '312 W 19th St', 'Houston', 'TX', '77008', '(713) 555-0119', 29.8028, -95.4005, 'Daily 6:30am – 11pm', array['Drive-thru','Coffee bar','Delivery'], 3),
('Pearl District', '303 Pearl Pkwy', 'San Antonio', 'TX', '78215', '(210) 555-0164', 29.4425, -98.4799, 'Daily 7am – 10pm', array['Patio','Curbside'], 4),
('East Nashville', '1006 Fatherland St', 'Nashville', 'TN', '37206', '(615) 555-0133', 36.1745, -86.7516, 'Daily 7am – 11pm', array['Drive-thru','Delivery'], 5),
('Ponce City', '675 Ponce De Leon Ave NE', 'Atlanta', 'GA', '30308', '(404) 555-0108', 33.7722, -84.3658, 'Daily 7am – 11pm', array['Coffee bar','Delivery','Curbside'], 6);

-- SEED MENU
with o as (
  select
  '[{"id":"patty","label":"Patties","type":"single","required":true,"choices":[{"id":"single","label":"Single","price_cents":0},{"id":"double","label":"Double","price_cents":250},{"id":"triple","label":"Triple","price_cents":450}]},{"id":"addons","label":"Add-ons","type":"multi","choices":[{"id":"cheese","label":"Extra cheddar","price_cents":100},{"id":"bacon","label":"Applewood bacon","price_cents":200},{"id":"egg","label":"Fried egg","price_cents":150},{"id":"jalapeno","label":"Grilled jalapeños","price_cents":75}]},{"id":"sauce","label":"Sauce","type":"single","required":true,"choices":[{"id":"swill","label":"Swill Sauce","price_cents":0},{"id":"bbq","label":"Smoky BBQ","price_cents":0},{"id":"chipotle","label":"Chipotle mayo","price_cents":0},{"id":"none","label":"No sauce","price_cents":0}]},{"id":"combo","label":"Make it a combo","type":"single","required":true,"choices":[{"id":"none","label":"Just the burger","price_cents":0},{"id":"classic","label":"+ Fries & fountain drink","price_cents":399},{"id":"loaded","label":"+ Loaded fries & shake","price_cents":699}]}]'::jsonb as burger,
  '[{"id":"heat","label":"Heat level","type":"single","required":true,"choices":[{"id":"mild","label":"Mild","price_cents":0},{"id":"medium","label":"Medium","price_cents":0},{"id":"hot","label":"Hot","price_cents":0},{"id":"reaper","label":"Reaper (sign the waiver)","price_cents":0}]},{"id":"dips","label":"Extra dips","type":"multi","choices":[{"id":"ranch","label":"Buttermilk ranch","price_cents":60},{"id":"honey","label":"Hot honey","price_cents":60},{"id":"swill","label":"Swill Sauce","price_cents":60}]},{"id":"combo","label":"Make it a combo","type":"single","required":true,"choices":[{"id":"none","label":"Just the chicken","price_cents":0},{"id":"classic","label":"+ Fries & fountain drink","price_cents":399}]}]'::jsonb as chicken,
  '[{"id":"size","label":"Size","type":"single","required":true,"choices":[{"id":"12","label":"12\" personal","price_cents":0},{"id":"16","label":"16\" share","price_cents":500}]},{"id":"crust","label":"Crust","type":"single","required":true,"choices":[{"id":"classic","label":"48-hour classic","price_cents":0},{"id":"thin","label":"Crackly thin","price_cents":0},{"id":"cauli","label":"Cauliflower","price_cents":200}]},{"id":"toppings","label":"Extra toppings","type":"multi","choices":[{"id":"mozz","label":"Extra mozzarella","price_cents":150},{"id":"pep","label":"Cup-and-char pepperoni","price_cents":200},{"id":"mush","label":"Roasted mushrooms","price_cents":125},{"id":"honey","label":"Hot honey drizzle","price_cents":100}]}]'::jsonb as pizza,
  '[{"id":"size","label":"Size","type":"single","required":true,"choices":[{"id":"reg","label":"Regular","price_cents":0},{"id":"lg","label":"Large","price_cents":150}]},{"id":"dips","label":"Dipping sauce","type":"multi","choices":[{"id":"swill","label":"Swill Sauce","price_cents":60},{"id":"ranch","label":"Buttermilk ranch","price_cents":60},{"id":"cheese","label":"Cheddar sauce","price_cents":90}]}]'::jsonb as sides,
  '[{"id":"size","label":"Size","type":"single","required":true,"choices":[{"id":"12","label":"12 oz","price_cents":0},{"id":"16","label":"16 oz","price_cents":75},{"id":"24","label":"24 oz","price_cents":150}]},{"id":"milk","label":"Milk","type":"single","required":true,"choices":[{"id":"whole","label":"Whole milk","price_cents":0},{"id":"oat","label":"Oat milk","price_cents":75},{"id":"almond","label":"Almond milk","price_cents":75},{"id":"none","label":"No milk","price_cents":0}]},{"id":"extras","label":"Extras","type":"multi","choices":[{"id":"shot","label":"Extra espresso shot","price_cents":100},{"id":"vanilla","label":"Vanilla syrup","price_cents":60},{"id":"caramel","label":"Caramel drizzle","price_cents":60},{"id":"foam","label":"Sweet cream cold foam","price_cents":125}]}]'::jsonb as coffee,
  '[{"id":"size","label":"Size","type":"single","required":true,"choices":[{"id":"16","label":"16 oz","price_cents":0},{"id":"24","label":"24 oz","price_cents":125}]},{"id":"extras","label":"Extras","type":"multi","choices":[{"id":"whip","label":"Extra whipped cream","price_cents":50},{"id":"malt","label":"Malt it","price_cents":75}]}]'::jsonb as cold
)
insert into public.menu_items (slug, category, name, description, price_cents, calories, image_key, tags, ingredients, options, is_featured, sort_order)
select v.slug, v.category, v.name, v.description, v.price_cents, v.calories, v.image_key, v.tags, v.ingredients,
  case v.opt when 'burger' then o.burger when 'chicken' then o.chicken when 'pizza' then o.pizza when 'sides' then o.sides when 'coffee' then o.coffee else o.cold end,
  v.featured, v.sort_order
from o, (values
  ('swill-smash','burgers','The Swill Smash','Two smashed chuck-and-brisket patties, melted American, caramelized onions, house pickles and Swill Sauce on a toasted brioche bun.',899,780,'burger',array['Signature','Bestseller'],array['Brioche bun','Chuck & brisket patty','American cheese','Caramelized onions','House pickles','Swill Sauce'],'burger',true,1),
  ('ember-bacon','burgers','Ember Bacon Burger','Fire-grilled patty, thick applewood bacon, aged cheddar, vine tomato and crisp lettuce on a sesame bun.',1049,910,'bacon_burger',array['Fan favorite'],array['Sesame bun','Fire-grilled patty','Applewood bacon','Aged cheddar','Tomato','Green leaf lettuce','Mayo'],'burger',true,2),
  ('hickory-stack','burgers','Hickory BBQ Stack','Double patty, smoked gouda, crispy onion strings and molasses BBQ sauce.',1099,960,'burger',array['Smoky'],array['Brioche bun','Chuck & brisket patty','Smoked gouda','Onion strings','Molasses BBQ'],'burger',false,3),
  ('garden-ember','burgers','Fire-Grilled Garden Burger','Black bean, roasted corn and poblano patty with pepper jack, avocado and chipotle mayo.',929,640,'bacon_burger',array['Vegetarian'],array['Sesame bun','Black bean patty','Pepper jack','Avocado','Chipotle mayo','Lettuce'],'burger',false,4),
  ('crispy-classic','chicken','Crispy Classic Sandwich','Buttermilk-brined thigh, pressure-fried golden, with pickles and spicy mayo on a buttered bun.',849,690,'chicken',array['Bestseller'],array['Brioche bun','Buttermilk-brined chicken','Pickles','Spicy mayo'],'chicken',true,1),
  ('nashville-hot','chicken','Nashville Hot Sandwich','Cayenne-lacquered crispy chicken, vinegar slaw and crinkle pickles.',929,740,'hot_chicken',array['Spicy'],array['Brioche bun','Crispy chicken','Nashville hot oil','Vinegar slaw','Crinkle pickles'],'chicken',true,2),
  ('tenders-four','chicken','Hand-Breaded Tenders (4)','Four whole-muscle tenders, breaded by hand every morning. Pick your heat.',899,620,'chicken',array['Hand-breaded'],array['Chicken tenderloin','Seasoned flour','Buttermilk'],'chicken',false,3),
  ('smoked-wings','chicken','Hickory Smoked Wings (8)','Smoked low for three hours, flash-fried and tossed in your heat of choice.',1149,820,'hot_chicken',array['Smoky'],array['Chicken wings','Hickory smoke','House rub'],'chicken',false,4),
  ('pepperoni-blaze','pizza','Pepperoni Blaze','Cup-and-char pepperoni, fior di latte, San Marzano tomato and torn basil on our 48-hour dough.',1399,1120,'pizza',array['Wood-fired','Bestseller'],array['48-hour dough','San Marzano tomato','Fior di latte','Cup-and-char pepperoni','Basil'],'pizza',true,1),
  ('margherita','pizza','Fresh Margherita','Hand-pulled mozzarella, crushed tomato, basil and cold-pressed olive oil.',1249,980,'margherita',array['Vegetarian','Wood-fired'],array['48-hour dough','Crushed tomato','Fresh mozzarella','Basil','Olive oil'],'pizza',false,2),
  ('hot-honey','pizza','Hot Honey Soppressata','Spicy soppressata, mozzarella, Calabrian chili and a hot honey finish.',1499,1180,'pizza',array['Sweet heat'],array['48-hour dough','Tomato','Mozzarella','Soppressata','Calabrian chili','Hot honey'],'pizza',false,3),
  ('bbq-chicken-pie','pizza','BBQ Chicken Pie','Smoked chicken, red onion, smoked gouda, cilantro and molasses BBQ.',1449,1150,'margherita',array['Smoky'],array['48-hour dough','Molasses BBQ','Smoked chicken','Red onion','Smoked gouda','Cilantro'],'pizza',false,4),
  ('hand-cut-fries','sides','Hand-Cut Fries','Idaho potatoes, cut in-house, twice-fried in peanut oil and showered with sea salt.',349,420,'fries',array['Cut daily'],array['Idaho potatoes','Peanut oil','Sea salt'],'sides',true,1),
  ('loaded-fries','sides','Loaded Swill Fries','Hand-cut fries buried in cheddar sauce, bacon crumble, jalapeños and Swill Sauce.',649,780,'fries',array['Shareable'],array['Idaho potatoes','Cheddar sauce','Bacon','Jalapeños','Swill Sauce'],'sides',false,2),
  ('onion-rings','sides','Beer-Battered Onion Rings','Sweet onions dipped in lager batter and fried crisp. Served with comeback sauce.',449,510,'onion_rings',array['Crunchy'],array['Sweet onion','Lager batter','Comeback sauce'],'sides',false,3),
  ('swill-cold-brew','drinks','Swill Cold Brew','Small-batch beans steeped for 18 hours, poured over ice with a cream swirl.',499,140,'coldbrew',array['Specialty coffee','18-hr steep'],array['Cold brew coffee','Ice','Cream'],'coffee',true,1),
  ('caramel-latte','drinks','Smoked Caramel Latte','Double ristretto, burnt-sugar caramel and steamed milk. Hot or iced.',549,260,'coldbrew',array['Specialty coffee'],array['Espresso','Caramel','Milk'],'coffee',false,2),
  ('vanilla-shake','drinks','Hand-Spun Vanilla Shake','Real vanilla bean custard, spun thick, topped with whipped cream and a cherry.',599,690,'shake',array['Hand-spun'],array['Vanilla custard','Whole milk','Whipped cream','Cherry'],'cold',true,3),
  ('honey-lemonade','drinks','Fresh Honey Lemonade','Lemons squeezed every morning, sweetened with wildflower honey.',349,180,'lemonade',array['Fresh-squeezed'],array['Lemon juice','Wildflower honey','Water','Ice'],'cold',false,4)
) as v(slug, category, name, description, price_cents, calories, image_key, tags, ingredients, opt, featured, sort_order);
