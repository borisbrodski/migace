package org.openbrod.migace;

/** Receives the notices of the database while a migration script runs: one line per part that ran, was skipped or failed. */
@FunctionalInterface
public interface NoticeListener {
    void notice(String message);
}
