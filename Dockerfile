FROM golang:1.26 AS build
WORKDIR /src
ENV GOPROXY=https://package-mirror.liara.ir/repository/go/
ENV GOSUMDB=off
COPY go.mod go.sum ./
RUN go mod download
COPY *.go ./
COPY migrations ./migrations
COPY web ./web
RUN CGO_ENABLED=0 go build -o /shop .

FROM alpine:3.22
WORKDIR /app
COPY --from=build /shop /app/shop
COPY docker-entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh
EXPOSE 8080
ENTRYPOINT ["/app/entrypoint.sh"]
