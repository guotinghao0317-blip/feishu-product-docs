# 语音需求取数

业务使用规模、用户覆盖和跨产品指标可交给 BI 助手。涉及真实语音请求、意图、目标应用、工具调用、回执和实际执行时，优先用已批准的只读语音 trace。两种来源分别核对粒度和分母。

## 一、接入和权限

- 向数据管理员获取当前架构的数据字典、分区和事件定义，以及组织批准的查询入口。若使用 MCP，按组织指南配置连接，再完成数据源要求的 OAuth 或 SSO。需要网关和目标库表、列的实际读取权限。
- 在本地配置中将 `voice.enabled` 设为 `true`。原生 MCP 接入填写 `mcp_server_name`，使用下方 Doris 兼容客户端时填写管理员提供的 HTTPS `endpoint`。可在 `guide_url` 留组织接入指南链接。首次连接先核对工具列表，并用不含业务数据的检查确认连接可用。
- 若网关可用但缺少目标表、列权限，先说明受影响的指标。可继续使用 BI 已验证的口径，或留下待补数据。

## 二、定义口径和执行

1. 核对版本、环境、流量范围、时间和时区。根据数据字典选对话、调用或回执数据。先用一个完整分区验证字段和样本，再扩大窗口。关联多张表时各自带分区，并用日期与 trace ID 核对粒度。跨天的用户或设备数重新去重。
2. 把需求分为保留、调整、下线等能力。分别定义用户明确指名、识别到的意图、实际目标应用、工具请求或回执和可证实的执行结果。泛播控只有能定位到目标应用时才归属，单纯提到应用名另计。处理同一 trace 的多次调用或重试，说明去重规则和重叠。
3. 核对回执语义。单独记录成功、失败、无回执和无法归因，写清成功率分母。只有回执或语音播报时，报告它证明的环节。实际起播需要可验证的播放器结果。
4. 交付聚合指标、样本日期、版本、人群、事件定义、字段和去重规则，以及受缺失字段或分区影响的结论。复核用的小样控制在必要字段内，群消息和文档优先使用聚合数据。

## 三、可选的 Doris 兼容客户端

已连接原生 MCP 时优先使用已接入的工具。若管理员提供的 Streamable HTTP 网关开放 `doris_catalog` 和 `doris_query`、支持浏览器 OAuth、本地回调，且授权页面与网关同源，可使用[兼容客户端](../scripts/doris-readonly.mjs)。它需要 Node.js 22+ 和 `@modelcontextprotocol/sdk` 1.30.0。SDK 可用 `npm install --prefix "<本地依赖目录>" @modelcontextprotocol/sdk@1.30.0` 安装到单独目录。服务端的只读账号和表级权限决定访问范围。

准备一个本地 JSON 文件，每项写 `name`、`tool` 和 `arguments`。可先用空 `arguments` 查看子工具，再用 `get_table_context` 核对字段、`explain_query` 检查计划、`execute_query` 执行有返回行数和超时上限的查询。连接检查示例：

```json
[
  {
    "name": "connection-check",
    "tool": "doris_query",
    "arguments": {
      "child_tool": "execute_query",
      "arguments": {
        "sql": "SELECT 1 AS ok",
        "max_rows": 1,
        "timeout_ms": 10000
      }
    }
  }
]
```

```bash
node scripts/doris-readonly.mjs "<组织批准的 HTTPS MCP 地址>" "<本地 SDK 安装目录>/node_modules/@modelcontextprotocol/sdk" "<本地请求文件>"
```

如果终端给出登录链接，用浏览器完成授权。客户端仅在进程内保存会话凭证，查询结果输出到终端。不同组织的认证方式和工具接口可能不同，以数据管理员的说明为准。
