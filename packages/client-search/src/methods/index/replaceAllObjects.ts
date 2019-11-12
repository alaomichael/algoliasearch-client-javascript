import { createWaitablePromise, encode, WaitablePromise } from '@algolia/client-common';
import { MethodEnum } from '@algolia/requester-common';
import { popRequestOption, RequestOptions } from '@algolia/transporter';

import { IndexOperationResponse, ReplaceAllObjectsOptions, SearchIndex } from '../..';
import { HasWaitTask, saveObjects, waitTask } from '.';

export const replaceAllObjects = <TSearchIndex extends SearchIndex>(
  base: TSearchIndex
): TSearchIndex & HasWaitTask & HasReplaceAllObjects => {
  return {
    ...waitTask(base),
    replaceAllObjects(
      objects: readonly object[],
      requestOptions?: ReplaceAllObjectsOptions & RequestOptions
    ): Readonly<WaitablePromise<void>> {
      const operation = (
        from: string,
        to: string,
        type: string,
        operatioRequestOptions?: RequestOptions
      ): Readonly<WaitablePromise<IndexOperationResponse>> => {
        return createWaitablePromise<IndexOperationResponse>(
          this.transporter.write(
            {
              method: MethodEnum.Post,
              path: encode('1/indexes/%s/operation', from),
              data: {
                operation: type,
                destination: to,
              },
            },
            operatioRequestOptions
          )
        ).onWait((response, waitRequestOptions) =>
          this.waitTask(response.taskID, waitRequestOptions)
        );
      };

      const safe = popRequestOption(requestOptions, 'safe', false);

      const randomSuffix = Math.random()
        .toString(36)
        .substring(7);

      const temporaryIndex = saveObjects({
        transporter: this.transporter,
        indexName: `${this.indexName}_tmp_${randomSuffix}`,
      });

      // eslint-disable-next-line prefer-const, functional/no-let, functional/prefer-readonly-type
      let responses: Array<Readonly<WaitablePromise<any>>> = [];

      const copyWaitablePromise = operation(this.indexName, temporaryIndex.indexName, 'copy', {
        ...requestOptions,
        scope: ['settings', 'synonyms', 'rules'],
      });

      // eslint-disable-next-line functional/immutable-data
      responses.push(copyWaitablePromise);

      const result = (safe ? copyWaitablePromise.wait(requestOptions) : copyWaitablePromise)
        .then(() => {
          const saveObjectsWaitablePromise = temporaryIndex.saveObjects(objects, requestOptions);

          // eslint-disable-next-line functional/immutable-data
          responses.push(saveObjectsWaitablePromise);

          return safe
            ? saveObjectsWaitablePromise.wait(requestOptions)
            : saveObjectsWaitablePromise;
        })
        .then(() => {
          const moveWaitablePromise = operation(
            temporaryIndex.indexName,
            this.indexName,
            'move',
            requestOptions
          );

          // eslint-disable-next-line functional/immutable-data
          responses.push(moveWaitablePromise);

          return safe ? moveWaitablePromise.wait(requestOptions) : moveWaitablePromise;
        })
        .then(() => Promise.resolve());

      return createWaitablePromise<void>(result).onWait((_, waitRequestOptions) => {
        return Promise.all(responses.map(response => response.wait(waitRequestOptions)));
      });
    },
  };
};

export type HasReplaceAllObjects = {
  readonly replaceAllObjects: (
    objects: readonly object[],
    requestOptions?: ReplaceAllObjectsOptions & RequestOptions
  ) => Readonly<WaitablePromise<void>>;
};