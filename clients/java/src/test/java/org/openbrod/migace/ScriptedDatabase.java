package org.openbrod.migace;

import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.SQLWarning;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

/** A database that answers as a test says. It records what is sent and how the connection was used. */
final class ScriptedDatabase {

    /** What the database answers to one statement. */
    static final class Answer {
        List<List<Object>> rows = new ArrayList<>();
        List<String> notices = new ArrayList<>();
        String errorCode;
        String errorMessage;
    }

    final List<String> sent = new ArrayList<>();
    final List<Answer> answers = new ArrayList<>();
    final List<String> log = new ArrayList<>();
    boolean autoCommit;
    boolean closed;

    Connection connection() {
        return (Connection) Proxy.newProxyInstance(getClass().getClassLoader(), new Class<?>[] {Connection.class}, (proxy, method, args) -> {
            switch (method.getName()) {
                case "getAutoCommit": return autoCommit;
                case "setAutoCommit": autoCommit = (Boolean) args[0]; log.add("autocommit " + autoCommit); return null;
                case "createStatement": return statement();
                case "close": closed = true; log.add("close"); return null;
                case "isClosed": return closed;
                default: throw new UnsupportedOperationException(method.getName());
            }
        });
    }

    private Statement statement() {
        Answer[] current = new Answer[1];
        InvocationHandler handler = (proxy, method, args) -> {
            switch (method.getName()) {
                case "execute": {
                    String sql = (String) args[0];
                    current[0] = sent.size() < answers.size() ? answers.get(sent.size()) : new Answer();
                    sent.add(sql);
                    log.add("send in autocommit " + autoCommit);
                    if (current[0].errorMessage != null) {
                        throw new SQLException(current[0].errorMessage, current[0].errorCode);
                    }
                    return !current[0].rows.isEmpty();
                }
                case "getResultSet": return resultSet(current[0].rows.iterator());
                case "getWarnings": {
                    SQLWarning first = null;
                    for (String notice : current[0] == null ? new ArrayList<String>() : current[0].notices) {
                        SQLWarning warning = new SQLWarning(notice);
                        if (first == null) {
                            first = warning;
                        } else {
                            first.setNextWarning(warning);
                        }
                    }
                    return first;
                }
                case "close": return null;
                default: throw new UnsupportedOperationException(method.getName());
            }
        };
        return (Statement) Proxy.newProxyInstance(getClass().getClassLoader(), new Class<?>[] {Statement.class}, handler);
    }

    private ResultSet resultSet(Iterator<List<Object>> rows) {
        List<Object>[] row = new List[1];
        return (ResultSet) Proxy.newProxyInstance(getClass().getClassLoader(), new Class<?>[] {ResultSet.class}, (proxy, method, args) -> {
            switch (method.getName()) {
                case "next": {
                    if (!rows.hasNext()) {
                        return false;
                    }
                    row[0] = rows.next();
                    return true;
                }
                case "getObject": return row[0].get((Integer) args[0] - 1);
                case "close": return null;
                default: throw new UnsupportedOperationException(method.getName());
            }
        });
    }
}
