-- Classify what recurrence means per category.
--
-- This is an editorial judgement, so it is stored explicitly rather than hidden
-- in a query. Repetition is not uniformly evidence of failure:
--
--   infrastructura -- a streetlight, pothole or road sign that is repaired and
--                     reported again did not stay repaired. Recurrence is
--                     evidence about the repair.
--   comportament   -- a car parked illegally again, or a bin overflowing again,
--                     is a NEW event. The council removing the car in 2019 says
--                     nothing about a different car in 2024. Recurrence here is
--                     evidence about enforcement frequency at most, and citing it
--                     as failed resolution would be misleading.
--   mixt           -- both readings are plausible; present without a claim.
--
-- Parcări neregulamentare dominates every raw recurrence ranking (538 reports at
-- one spot over 8 years) and is precisely the category where the failure reading
-- does not hold. Labelling it prevents the strongest-looking numbers from being
-- the weakest evidence.

alter table public.categories
  add column if not exists recurrence_meaning text
  check (recurrence_meaning in ('infrastructura', 'comportament', 'mixt'));

update public.categories set recurrence_meaning = case id
  when 4  then 'infrastructura'   -- Iluminat public
  when 9  then 'infrastructura'   -- Străzi/Alei/Trotuare/Poduri
  when 11 then 'infrastructura'   -- Semnalizare rutieră
  when 14 then 'infrastructura'   -- Rețele de apă/canalizare
  when 3  then 'infrastructura'   -- Construcții neautorizate
  when 16 then 'comportament'     -- Parcări neregulamentare
  when 2  then 'comportament'     -- Depozitări deşeuri
  when 7  then 'comportament'     -- Salubritate
  when 12 then 'comportament'     -- Tulburarea liniștii publice
  when 1  then 'comportament'     -- Asistență socială
  when 6  then 'comportament'     -- Persoane fără adăpost
  else 'mixt'                     -- 5, 8, 10, 13, 15
end;

alter table public.categories alter column recurrence_meaning set not null;
